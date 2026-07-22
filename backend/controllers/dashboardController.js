const { resolveAllowedWidgets, pickFields } = require('../utils/dashboardWidgets');
const Settings = require('../models/Settings');
const {
  grossRevenueMatchStage,
  refundMatchStage,
  GROSS_COLLECTED_EXPR,
  round2,
} = require('../utils/financeCalculations');

const Member = require('../models/Member');
const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Equipment = require('../models/Equipment');
const asyncHandler = require('../utils/asyncHandler');

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfNextMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

// @desc  Summary cards for the dashboard
// @route GET /api/dashboard/summary
const summary = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = startOfNextMonth(now);
  const soon = new Date(now.getTime() + 7 * DAY_MS);

  const [
    totalMembers,
    activeMembers,
    expiredMembers,
    newMembersThisMonth,
    monthlyGrossRevenueAgg,
    monthlyRefundsAgg,
    monthlyExpenseAgg,
    equipmentCount,
    expiringMemberships,
    pendingPaymentsAgg,
  ] = await Promise.all([
    Member.countDocuments({ isDeleted: false }),
    Member.countDocuments({ isDeleted: false, status: 'active' }),
    Member.countDocuments({ isDeleted: false, status: 'expired' }),
    Member.countDocuments({ isDeleted: false, joiningDate: { $gte: monthStart, $lt: nextMonthStart } }),
    // FIX: previously matched status $in ['paid','partial'] BEFORE summing,
    // which excluded the ENTIRE amount of any payment later touched by a
    // refund (status becomes 'refunded'/'partially_refunded'). Now sums gross
    // collections across all money-was-collected statuses, and subtracts
    // refunds separately below — see utils/financeCalculations.js.
    Payment.aggregate([
      grossRevenueMatchStage('paymentDate', monthStart, nextMonthStart),
      { $group: { _id: null, total: { $sum: GROSS_COLLECTED_EXPR } } },
    ]),
    Payment.aggregate([
      refundMatchStage(monthStart, nextMonthStart),
      { $group: { _id: null, total: { $sum: '$refund.refundedAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: { $gte: monthStart, $lt: nextMonthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Equipment.countDocuments({ status: { $ne: 'retired' } }),
    Membership.countDocuments({ status: 'active', endDate: { $gte: now, $lte: soon } }),
    // Every live (active/frozen) membership that still has money owed on it —
    // invoiced minus actually-collected, net of refunds. Nothing auto-bills a
    // membership, so this is the only place that surfaces "who owes what".
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
                    {
                      $subtract: [
                        { $ifNull: ['$$p.amountPaid', '$$p.finalAmount'] },
                        { $ifNull: ['$$p.refund.refundedAmount', 0] },
                      ],
                    },
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

  const monthlyGrossRevenue = monthlyGrossRevenueAgg[0]?.total || 0;
  const monthlyRefunds = round2(monthlyRefundsAgg[0]?.total || 0);
  const monthlyRevenue = round2(monthlyGrossRevenue - monthlyRefunds); // net revenue, now correct
  const monthlyExpenses = monthlyExpenseAgg[0]?.total || 0;
  const pendingPayments = pendingPaymentsAgg[0]?.total || 0;
  const pendingPaymentsCount = pendingPaymentsAgg[0]?.count || 0;

  const summaryData = {
    totalMembers,
    activeMembers,
    expiredMembers,
    newMembersThisMonth,
    monthlyRevenue,
    monthlyRefunds,
    monthlyExpenses,
    netProfit: round2(monthlyRevenue - monthlyExpenses),
    equipmentCount,
    membershipsExpiringSoon: expiringMemberships,
    pendingPayments,
    pendingPaymentsCount,
  };

  const settings = await Settings.getSingleton();
  const allowedWidgets = await resolveAllowedWidgets(req.user, settings);
  const filtered = pickFields(summaryData, allowedWidgets, 'summaryFields');

  res.json({ success: true, data: filtered, allowedWidgets });
});

// @desc  Chart data for the dashboard (revenue, membership growth, expense/profit analysis, plan distribution)
// @route GET /api/dashboard/charts?year=2026
const charts = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [grossByMonth, refundByMonth, expenseByMonth, membershipGrowth, planDistribution] = await Promise.all([
    // FIX: same gross-minus-refunds correction as summary() above.
    Payment.aggregate([
      grossRevenueMatchStage('paymentDate', start, end),
      { $group: { _id: { $month: '$paymentDate' }, total: { $sum: GROSS_COLLECTED_EXPR } } },
    ]),
    Payment.aggregate([
      refundMatchStage(start, end),
      { $group: { _id: { $month: '$refund.refundDate' }, total: { $sum: '$refund.refundedAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: { $gte: start, $lt: end } } },
      { $group: { _id: { $month: '$expenseDate' }, total: { $sum: '$amount' } } },
    ]),
    Member.aggregate([
      { $match: { joiningDate: { $gte: start, $lt: end }, isDeleted: false } },
      { $group: { _id: { $month: '$joiningDate' }, count: { $sum: 1 } } },
    ]),
    Membership.aggregate([
      { $match: { status: 'active' } },
      { $lookup: { from: 'membershipplans', localField: 'plan', foreignField: '_id', as: 'planDoc' } },
      { $unwind: '$planDoc' },
      { $group: { _id: '$planDoc.name', count: { $sum: 1 } } },
    ]),
  ]);

  const monthly = (agg, key = 'total') =>
    Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      [key]: agg.find((a) => a._id === i + 1)?.[key] || 0,
    }));

  const grossRevenue = monthly(grossByMonth);
  const refunds = monthly(refundByMonth);
  const revenue = grossRevenue.map((r, i) => ({ month: r.month, total: round2(r.total - refunds[i].total) }));
  const expenses = monthly(expenseByMonth);
  const profitByMonth = revenue.map((r, i) => ({ month: r.month, profit: round2(r.total - expenses[i].total) }));

  const chartData = {
    revenueByMonth: revenue,
    membershipGrowth: monthly(membershipGrowth, 'count'),
    expenseByMonth: expenses,
    profitByMonth,
    planDistribution: planDistribution.map((item) => ({ plan: item._id, count: item.count })),
  };

  const settings = await Settings.getSingleton();
  const allowedWidgets = await resolveAllowedWidgets(req.user, settings);
  const filtered = pickFields({ ...chartData, year }, allowedWidgets, 'chartFields');

  res.json({ success: true, data: { year, ...filtered }, allowedWidgets });
});

module.exports = { summary, charts };