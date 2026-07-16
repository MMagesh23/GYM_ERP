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
    monthlyRevenueAgg,
    monthlyExpenseAgg,
    equipmentCount,
    expiringMemberships,
    pendingPaymentsAgg,
  ] = await Promise.all([
    Member.countDocuments({ isDeleted: false }),
    Member.countDocuments({ isDeleted: false, status: 'active' }),
    Member.countDocuments({ isDeleted: false, status: 'expired' }),
    Member.countDocuments({ isDeleted: false, joiningDate: { $gte: monthStart, $lt: nextMonthStart } }),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: monthStart, $lt: nextMonthStart }, status: { $in: ['paid', 'partial'] } } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: { $gte: monthStart, $lt: nextMonthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Equipment.countDocuments({ status: { $ne: 'retired' } }),
    Membership.countDocuments({ status: 'active', endDate: { $gte: now, $lte: soon } }),
    Payment.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$finalAmount' }, count: { $sum: 1 } } }]),
  ]);

  const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;
  const monthlyExpenses = monthlyExpenseAgg[0]?.total || 0;

  res.json({
    success: true,
    data: {
      totalMembers,
      activeMembers,
      expiredMembers,
      newMembersThisMonth,
      monthlyRevenue,
      monthlyExpenses,
      netProfit: monthlyRevenue - monthlyExpenses,
      equipmentCount,
      membershipsExpiringSoon: expiringMemberships,
      pendingPayments: { count: pendingPaymentsAgg[0]?.count || 0, total: pendingPaymentsAgg[0]?.total || 0 },
    },
  });
});

// @desc  Chart data for the dashboard (revenue, membership growth, expense/profit analysis, plan distribution)
// @route GET /api/dashboard/charts?year=2026
const charts = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [revenueByMonth, expenseByMonth, membershipGrowth, planDistribution] = await Promise.all([
    Payment.aggregate([
      { $match: { paymentDate: { $gte: start, $lt: end }, status: { $in: ['paid', 'partial'] } } },
      { $group: { _id: { $month: '$paymentDate' }, total: { $sum: '$finalAmount' } } },
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

  const revenue = monthly(revenueByMonth);
  const expenses = monthly(expenseByMonth);
  const profit = revenue.map((r, i) => ({ month: r.month, profit: r.total - expenses[i].total }));

  res.json({
    success: true,
    data: {
      year,
      revenueByMonth: revenue,
      expenseByMonth: expenses,
      profitByMonth: profit,
      membershipGrowth: monthly(membershipGrowth, 'count'),
      planDistribution: planDistribution.map((p) => ({ plan: p._id, count: p.count })),
    },
  });
});

module.exports = { summary, charts };
