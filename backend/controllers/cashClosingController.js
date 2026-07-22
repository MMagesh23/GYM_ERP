const CashClosing = require('../models/CashClosing');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');

const DAY_MS = 24 * 60 * 60 * 1000;

const computeCashActivity = async (dayStart) => {
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const [collectedAgg, expenseAgg] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          paymentMethod: 'cash',
          paymentDate: { $gte: dayStart, $lt: dayEnd },
          status: { $in: ['paid', 'partial', 'refunded', 'partially_refunded'] },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $max: [
                { $subtract: [{ $ifNull: ['$amountPaid', '$finalAmount'] }, { $ifNull: ['$refund.refundedAmount', 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { paymentMethod: 'cash', expenseDate: { $gte: dayStart, $lt: dayEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    cashCollections: Math.max(collectedAgg[0]?.total || 0, 0),
    cashExpenses: expenseAgg[0]?.total || 0,
  };
};

const resolveOpeningCash = async (dayStart) => {
  const prevDay = new Date(dayStart.getTime() - DAY_MS);
  const prevClosing = await CashClosing.findOne({ date: prevDay, status: 'closed' });
  return prevClosing ? prevClosing.actualClosingCash ?? prevClosing.expectedClosingCash : 0;
};

// @desc  Live preview of today's (or any day's) expected cash position without persisting anything
// @route GET /api/finance/cash-closing/preview?date=2026-07-21
const previewClosing = asyncHandler(async (req, res) => {
  const dayStart = CashClosing.normalizeDate(req.query.date ? new Date(req.query.date) : new Date());
  const [{ cashCollections, cashExpenses }, openingCash] = await Promise.all([
    computeCashActivity(dayStart),
    resolveOpeningCash(dayStart),
  ]);
  const expectedClosingCash = Math.round((openingCash + cashCollections - cashExpenses) * 100) / 100;

  const existing = await CashClosing.findOne({ date: dayStart });

  res.json({
    success: true,
    data: {
      date: dayStart,
      openingCash,
      cashCollections,
      cashExpenses,
      expectedClosingCash,
      status: existing?.status || 'draft',
      actualClosingCash: existing?.actualClosingCash,
      variance: existing?.variance,
      varianceReason: existing?.varianceReason,
    },
  });
});

// @desc  List closing history with pagination + date range
// @route GET /api/finance/cash-closing?from=&to=&page=&limit=
const listClosings = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { from, to } = req.query;

  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = CashClosing.normalizeDate(new Date(from));
    if (to) filter.date.$lte = CashClosing.normalizeDate(new Date(to));
  }

  const [closings, total] = await Promise.all([
    CashClosing.find(filter)
      .populate('closedBy', 'name role')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CashClosing.countDocuments(filter),
  ]);

  res.json({ success: true, data: closings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// @desc  Finalize (close) a day's cash drawer.
//
// FIX (race condition): the previous version did findOne() -> check status
// -> save(), which is check-then-act — two near-simultaneous close requests
// for the same day could both pass the "not already closed" check before
// either had written. This version uses a single atomic findOneAndUpdate
// whose FILTER includes the "not already closed" condition, so MongoDB
// evaluates the check and the write as one operation. If a second request
// loses the race, its filter simply won't match (the first request already
// flipped status to 'closed'), so upsert:true tries to INSERT a second
// document — which the unique index on `date` rejects with E11000, caught
// below and surfaced as the same friendly "already closed" error.
// @route POST /api/finance/cash-closing/close
// body: { date?, actualClosingCash, varianceReason?, notes? }
const closeDrawer = asyncHandler(async (req, res) => {
  const { date, actualClosingCash, varianceReason, notes } = req.body;
  if (actualClosingCash === undefined || actualClosingCash === null || Number(actualClosingCash) < 0) {
    throw new ApiError(400, 'actualClosingCash is required and must be a non-negative number.');
  }

  const dayStart = CashClosing.normalizeDate(date ? new Date(date) : new Date());

  const [{ cashCollections, cashExpenses }, openingCash] = await Promise.all([
    computeCashActivity(dayStart),
    resolveOpeningCash(dayStart),
  ]);
  const expectedClosingCash = Math.round((openingCash + cashCollections - cashExpenses) * 100) / 100;
  const variance = Math.round((Number(actualClosingCash) - expectedClosingCash) * 100) / 100;

  if (variance !== 0 && !varianceReason) {
    throw new ApiError(
      400,
      `There's a cash variance of ${variance.toFixed(2)}. A varianceReason is required to close with a discrepancy.`
    );
  }

  const setPayload = {
    date: dayStart,
    openingCash,
    cashCollections,
    cashExpenses,
    expectedClosingCash,
    actualClosingCash: Number(actualClosingCash),
    variance,
    varianceReason: varianceReason || '',
    notes: notes || '',
    status: 'closed',
    closedBy: req.user._id,
    closedAt: new Date(),
  };

  let closing;
  try {
    closing = await CashClosing.findOneAndUpdate(
      { date: dayStart, status: { $ne: 'closed' } }, // atomic check + write
      { $set: setPayload, $setOnInsert: { createdBy: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(
        409,
        `${dayStart.toDateString()} has already been closed. Corrections must go through a reversing note, not a re-close.`
      );
    }
    throw err;
  }

  await logAudit(req, {
    action: 'update',
    module: 'finance',
    targetId: closing._id,
    description:
      `Closed cash drawer for ${dayStart.toDateString()}: expected ${expectedClosingCash.toFixed(2)}, ` +
      `actual ${Number(actualClosingCash).toFixed(2)}, variance ${variance.toFixed(2)}` +
      (variance !== 0 ? ` (${varianceReason})` : ''),
  });

  res.status(201).json({ success: true, data: closing });
});

// @desc  Admin-only: reopen a previously closed day (e.g. a mistake was found
// after closing). Does NOT delete the closed snapshot's history — it's kept
// implicitly via the audit log entry recorded here; the document itself
// flips back to 'draft' so closeDrawer can be run again for that date.
// @route POST /api/finance/cash-closing/:id/reopen
const reopenClosing = asyncHandler(async (req, res) => {
  const closing = await CashClosing.findById(req.params.id);
  if (!closing) throw new ApiError(404, 'Cash closing record not found.');
  if (closing.status !== 'closed') throw new ApiError(400, 'This day is not currently closed.');

  const { reason } = req.body;
  if (!reason) throw new ApiError(400, 'A reason is required to reopen a closed cash day.');

  const previousSnapshot = {
    actualClosingCash: closing.actualClosingCash,
    variance: closing.variance,
    closedBy: closing.closedBy,
    closedAt: closing.closedAt,
  };

  closing.status = 'draft';
  closing.notes = `${closing.notes ? closing.notes + '\n' : ''}[Reopened ${new Date().toISOString()} by ${req.user.name}: ${reason}]`;
  await closing.save();

  await logAudit(req, {
    action: 'update',
    module: 'finance',
    targetId: closing._id,
    description:
      `Reopened cash closing for ${closing.date.toDateString()} (was closed by ` +
      `${previousSnapshot.closedBy} with actual ${previousSnapshot.actualClosingCash}): ${reason}`,
  });

  res.json({ success: true, data: closing });
});

module.exports = { previewClosing, listClosings, closeDrawer, reopenClosing, computeCashActivity, resolveOpeningCash };