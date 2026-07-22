const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Membership = require('../models/Membership');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const {
  grossRevenueMatchStage,
  refundMatchStage,
  GROSS_COLLECTED_EXPR,
  round2,
} = require('../utils/financeCalculations');

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

// Shared by the JSON route below and reportController's Excel/CSV export, so
// the two can never disagree on numbers.
const computeRevenueByPlan = async (from, to) => {
  const rows = await Payment.aggregate([
    { $match: { paymentDate: { $gte: from, $lt: to }, status: { $in: ['paid', 'partial', 'refunded', 'partially_refunded'] }, membership: { $ne: null } } },
    { $lookup: { from: 'memberships', localField: 'membership', foreignField: '_id', as: 'm' } },
    { $unwind: '$m' },
    { $lookup: { from: 'membershipplans', localField: 'm.plan', foreignField: '_id', as: 'plan' } },
    { $unwind: '$plan' },
    {
      $group: {
        _id: '$plan.name',
        total: {
          $sum: {
            $max: [
              { $subtract: [{ $ifNull: ['$amountPaid', '$finalAmount'] }, { $ifNull: ['$refund.refundedAmount', 0] }] },
              0,
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ plan: r._id, total: round2(r.total), count: r.count }));
};

// @desc  Date-range-filterable finance dashboard: today/month collection,
// revenue vs expense trend, payment-method breakdown, outstanding total.
// @route GET /api/finance/summary?from=&to=
const financeSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const monthStart = startOfMonth(now);

  const from = req.query.from ? startOfDay(new Date(req.query.from)) : monthStart;
  const to = req.query.to ? new Date(startOfDay(new Date(req.query.to)).getTime() + DAY_MS) : new Date(todayEnd);

  const [
    todayGrossAgg,
    todayRefundAgg,
    monthGrossAgg,
    monthRefundAgg,
    rangeGrossByDay,
    rangeRefundByDay,
    rangeExpenseByDay,
    methodBreakdown,
    outstandingAgg,
  ] = await Promise.all([
    Payment.aggregate([grossRevenueMatchStage('paymentDate', todayStart, todayEnd), { $group: { _id: null, total: { $sum: GROSS_COLLECTED_EXPR } } }]),
    Payment.aggregate([refundMatchStage(todayStart, todayEnd), { $group: { _id: null, total: { $sum: '$refund.refundedAmount' } } }]),
    Payment.aggregate([grossRevenueMatchStage('paymentDate', monthStart, todayEnd), { $group: { _id: null, total: { $sum: GROSS_COLLECTED_EXPR } } }]),
    Payment.aggregate([refundMatchStage(monthStart, todayEnd), { $group: { _id: null, total: { $sum: '$refund.refundedAmount' } } }]),
    Payment.aggregate([
      grossRevenueMatchStage('paymentDate', from, to),
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } }, total: { $sum: GROSS_COLLECTED_EXPR } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      refundMatchStage(from, to),
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$refund.refundDate' } }, total: { $sum: '$refund.refundedAmount' } } },
      { $sort: { _id: 1 } },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: { $gte: from, $lt: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      grossRevenueMatchStage('paymentDate', from, to),
      { $group: { _id: '$paymentMethod', total: { $sum: GROSS_COLLECTED_EXPR }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    // Reuses the exact same billing-outstanding logic as membershipController.outstandingMemberships
    Membership.aggregate([
      { $match: { status: { $in: ['active', 'frozen'] } } },
      { $lookup: { from: 'payments', localField: '_id', foreignField: 'membership', as: 'pmts' } },
      {
        $addFields: {
          collected: {
            $sum: {
              $map: {
                input: { $filter: { input: '$pmts', cond: { $ne: ['$$this.status', 'failed'] } } },
                as: 'p',
                in: {
                  $max: [
                    { $subtract: [{ $ifNull: ['$$p.amountPaid', '$$p.finalAmount'] }, { $ifNull: ['$$p.refund.refundedAmount', 0] }] },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      { $addFields: { outstanding: { $max: [{ $subtract: ['$finalAmount', '$collected'] }, 0] } } },
      { $match: { outstanding: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$outstanding' }, count: { $sum: 1 } } },
    ]),
  ]);

  const todayCollection = round2((todayGrossAgg[0]?.total || 0) - (todayRefundAgg[0]?.total || 0));
  const monthCollection = round2((monthGrossAgg[0]?.total || 0) - (monthRefundAgg[0]?.total || 0));

  // Merge revenue/refund/expense day series into one aligned trend array
  const days = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) days.push(new Date(t).toISOString().slice(0, 10));
  const grossByDay = new Map(rangeGrossByDay.map((r) => [r._id, r.total]));
  const refundByDay = new Map(rangeRefundByDay.map((r) => [r._id, r.total]));
  const expenseByDay = new Map(rangeExpenseByDay.map((r) => [r._id, r.total]));
  const trend = days.map((date) => {
    const gross = grossByDay.get(date) || 0;
    const refund = refundByDay.get(date) || 0;
    const revenue = round2(gross - refund);
    const expense = expenseByDay.get(date) || 0;
    return { date, revenue, expense, profit: round2(revenue - expense) };
  });

  const settings = await Settings.getSingleton();

  res.json({
    success: true,
    data: {
      currency: settings.currencySymbol,
      range: { from, to },
      todayCollection,
      monthCollection,
      outstanding: outstandingAgg[0]?.total || 0,
      outstandingCount: outstandingAgg[0]?.count || 0,
      trend,
      paymentMethodBreakdown: methodBreakdown.map((m) => ({ method: m._id, total: round2(m.total), count: m.count })),
    },
  });
});

// @desc  Revenue grouped by membership plan (for reports + dashboard)
// @route GET /api/finance/revenue-by-plan?from=&to=
const revenueByPlan = asyncHandler(async (req, res) => {
  const from = req.query.from ? startOfDay(new Date(req.query.from)) : startOfMonth(new Date());
  const to = req.query.to ? new Date(startOfDay(new Date(req.query.to)).getTime() + DAY_MS) : new Date();
  const rows = await computeRevenueByPlan(from, to);
  res.json({ success: true, data: rows });
});

module.exports = { financeSummary, revenueByPlan, computeRevenueByPlan };