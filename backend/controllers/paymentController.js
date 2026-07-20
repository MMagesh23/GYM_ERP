const ExcelJS = require('exceljs');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Member = require('../models/Member');
const Membership = require('../models/Membership');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { generateEntityId } = require('../utils/idGenerator');
const { streamInvoicePdf } = require('../utils/generateInvoicePdf');
const { validateRefundAmount } = require('../utils/billing');
const { buildSort } = require('../utils/sorting');

const PAYMENT_SORT_FIELDS = ['paymentDate', 'finalAmount', 'status'];

// @desc  Record a new payment (optionally linked to a membership) and generate its invoice
// @route POST /api/payments
// body: { memberId, membershipId?, amount, discount?, tax?, paymentMethod, transactionNumber?, status?, amountPaid?, notes? }
const createPayment = asyncHandler(async (req, res) => {
  const { memberId, membershipId, amount, discount = 0, tax = 0, paymentMethod, transactionNumber, status, notes, amountPaid } = req.body;

  const member = await Member.findById(memberId);
  if (!member || member.isDeleted) throw new ApiError(404, 'Member not found.');

  let membership = null;
  if (membershipId) {
    membership = await Membership.findById(membershipId).populate('plan');
    if (!membership) throw new ApiError(404, 'Membership not found.');
    // Verify this membership actually belongs to the member being billed — a
    // caller sending memberId=A + membershipId=<B's membership> must not be able
    // to create a payment/invoice against A that references B's membership record.
    if (String(membership.member) !== String(member._id)) {
      throw new ApiError(400, 'This membership does not belong to the selected member.');
    }
  }

  const finalAmount = Math.round((Number(amount) - Number(discount) + Number(tax)) * 100) / 100;
  const resolvedStatus = status || 'paid';

  // FIX: amountPaid tracks what was ACTUALLY collected, independent of finalAmount
  // (what was invoiced). Without this, a 'partial' payment's collected amount was
  // indistinguishable from a fully-paid one anywhere downstream (refunds, revenue
  // reporting, pending-balance totals).
  let resolvedAmountPaid;
  if (resolvedStatus === 'paid') {
    resolvedAmountPaid = finalAmount;
  } else if (resolvedStatus === 'pending' || resolvedStatus === 'failed') {
    resolvedAmountPaid = 0;
  } else if (resolvedStatus === 'partial') {
    if (amountPaid === undefined || amountPaid === null || amountPaid === '') {
      throw new ApiError(400, 'amountPaid is required when status is "partial".');
    }
    resolvedAmountPaid = Number(amountPaid);
    if (!(resolvedAmountPaid > 0) || resolvedAmountPaid >= finalAmount) {
      throw new ApiError(
        400,
        'For a partial payment, amountPaid must be greater than 0 and less than the total due. ' +
          'Use "paid" if collecting in full, or "pending" if nothing was collected yet.'
      );
    }
  } else {
    resolvedAmountPaid = 0;
  }

  const invoiceNumber = await generateEntityId('invoiceNumber', 'INV', 5);

  const payment = await Payment.create({
    invoiceNumber,
    member: member._id,
    membership: membership?._id,
    amount: Number(amount),
    discount: Number(discount),
    tax: Number(tax),
    finalAmount,
    amountPaid: resolvedAmountPaid,
    paymentMethod,
    transactionNumber,
    status: resolvedStatus,
    notes,
    receivedBy: req.user._id,
  });

  const invoice = await Invoice.create({
    invoiceNumber,
    member: member._id,
    payment: payment._id,
    membership: membership?._id,
    lineItems: [
      {
        description: membership ? `${membership.plan.name} membership` : 'Payment',
        quantity: 1,
        unitPrice: Number(amount),
        amount: Number(amount),
      },
    ],
    subTotal: Number(amount),
    discount: Number(discount),
    tax: Number(tax),
    grandTotal: finalAmount,
    issuedBy: req.user._id,
  });

  payment.invoice = invoice._id;
  await payment.save();

  if (membership) {
    membership.invoice = invoice._id;
    await membership.save();
  }

  await logAudit(req, {
    action: 'payment',
    module: 'payments',
    targetId: payment._id,
    description:
      `Recorded payment ${invoiceNumber} for member ${member.memberId} (${finalAmount})` +
      (resolvedStatus === 'partial'
        ? ` — ${resolvedAmountPaid} collected, ${(finalAmount - resolvedAmountPaid).toFixed(2)} outstanding`
        : ''),
  });

  res.status(201).json({ success: true, data: payment });
});

// @desc  List payments with filters, sorting, and pagination
// @route GET /api/payments?page=&limit=&status=&method=&memberId=&from=&to=&sortBy=&sortDir=
const listPayments = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { status, method, memberId, from, to, sortBy, sortDir } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (method) filter.paymentMethod = method;
  if (memberId) filter.member = memberId;
  if (from || to) {
    filter.paymentDate = {};
    if (from) filter.paymentDate.$gte = new Date(from);
    if (to) filter.paymentDate.$lte = new Date(to);
  }

  const sort = buildSort(sortBy, sortDir, PAYMENT_SORT_FIELDS, { paymentDate: -1 });

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('member', 'memberId firstName lastName phone')
      .populate({ path: 'membership', populate: { path: 'plan', select: 'name' } })
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc  Get a single payment
// @route GET /api/payments/:id
const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('member', 'memberId firstName lastName phone email')
    .populate({ path: 'membership', populate: { path: 'plan', select: 'name' } });
  if (!payment) throw new ApiError(404, 'Payment not found.');
  res.json({ success: true, data: payment });
});

// @desc  Download the PDF invoice for a payment
// @route GET /api/payments/:id/invoice
const downloadInvoice = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('member').populate('invoice');
  if (!payment) throw new ApiError(404, 'Payment not found.');

  const invoice = payment.invoice || (await Invoice.findOne({ payment: payment._id }));
  if (!invoice) throw new ApiError(404, 'Invoice not found for this payment.');

  const settings = await Settings.getSingleton();

  streamInvoicePdf(res, {
    invoiceNumber: invoice.invoiceNumber,
    issuedDate: invoice.issuedDate,
    gym: {
      name: settings.gymName,
      address: settings.address,
      contact: settings.contactNumber,
      email: settings.email,
      gst: settings.gstNumber,
      footer: settings.receiptFooterMessage,
      currency: settings.currencySymbol,
    },
    member: {
      memberId: payment.member.memberId,
      name: `${payment.member.firstName} ${payment.member.lastName || ''}`.trim(),
      phone: payment.member.phone,
      email: payment.member.email,
    },
    lineItems: invoice.lineItems,
    subTotal: invoice.subTotal,
    discount: invoice.discount,
    tax: invoice.tax,
    grandTotal: invoice.grandTotal,
    paymentMethod: payment.paymentMethod,
    transactionNumber: payment.transactionNumber,
  });
});

// @desc  Refund a payment (full or partial)
// @route POST /api/payments/:id/refund
// body: { amount, reason }
//
// FIX: previously capped the refund against finalAmount (invoiced total), not what
// was actually collected — a partially-paid or even a pending/failed payment could
// be "refunded" for more money than the gym ever received. Now capped against
// amountPaid and blocked entirely for statuses where nothing was collected.
const refundPayment = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found.');

  const refundAmount = Number(amount);
  const check = validateRefundAmount(payment, refundAmount);
  if (!check.valid) throw new ApiError(400, check.message);

  payment.refund.isRefunded = true;
  payment.refund.refundedAmount = (payment.refund.refundedAmount || 0) + refundAmount;
  payment.refund.refundDate = new Date();
  payment.refund.reason = reason || '';

  const collected = payment.amountPaid ?? payment.finalAmount;
  payment.status =
    payment.refund.refundedAmount >= collected
      ? 'refunded'
      : payment.refund.refundedAmount > 0
      ? 'partially_refunded'
      : payment.status;
  await payment.save();

  await logAudit(req, {
    action: 'update',
    module: 'payments',
    targetId: payment._id,
    description: `Refunded ${refundAmount} on payment ${payment.invoiceNumber}: ${reason || 'no reason given'}`,
  });

  res.json({ success: true, data: payment });
});

// @desc  Export payments to Excel
// @route GET /api/payments/export
const exportPayments = asyncHandler(async (req, res) => {
  const { status, method, sortBy, sortDir } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (method) filter.paymentMethod = method;

  const sort = buildSort(sortBy, sortDir, PAYMENT_SORT_FIELDS, { paymentDate: -1 });

  const payments = await Payment.find(filter).populate('member', 'memberId firstName lastName').sort(sort);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Payments');
  sheet.columns = [
    { header: 'Invoice #', key: 'invoiceNumber', width: 16 },
    { header: 'Member', key: 'member', width: 24 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Tax', key: 'tax', width: 10 },
    { header: 'Final Amount', key: 'finalAmount', width: 14 },
    // FIX: exports previously only showed the invoiced total, with no visibility
    // into what was actually collected vs. still outstanding on partial payments,
    // or how much of a payment had been refunded — both feed real accounting.
    { header: 'Collected', key: 'amountPaid', width: 14 },
    { header: 'Outstanding', key: 'outstanding', width: 14 },
    { header: 'Refunded', key: 'refunded', width: 12 },
    { header: 'Method', key: 'paymentMethod', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Date', key: 'paymentDate', width: 14 },
  ];
  payments.forEach((p) => {
    const collected = p.amountPaid ?? p.finalAmount;
    sheet.addRow({
      invoiceNumber: p.invoiceNumber,
      member: p.member ? `${p.member.memberId} - ${p.member.firstName} ${p.member.lastName || ''}` : '',
      amount: p.amount,
      discount: p.discount,
      tax: p.tax,
      finalAmount: p.finalAmount,
      amountPaid: collected,
      outstanding: Math.max(p.finalAmount - collected, 0),
      refunded: p.refund?.refundedAmount || 0,
      paymentMethod: p.paymentMethod,
      status: p.status,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
    });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="payments-export.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  createPayment,
  listPayments,
  getPayment,
  downloadInvoice,
  refundPayment,
  exportPayments,
};