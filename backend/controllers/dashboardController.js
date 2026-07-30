const { resolveAllowedWidgets, pickFields } = require('../utils/dashboardWidgets');
const Settings = require('../models/Settings');
const {
  grossRevenueMatchStage,
  refundMatchStage,
  GROSS_COLLECTED_EXPR,
  round2,
} = require('../utils/financeCalculations');
const { getExpiryWindow, calcDaysRemaining, expiryStatusLabel } = require('../utils/membershipExpiry');
const { hasPermission } = require('../middleware/rbac');
const { attachBillingSummaries } = require('./membershipController');

const Member = require('../models/Member');
const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Equipment = require('../models/Equipment');
const asyncHandler = require('../utils/asyncHandler');

const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfNextMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

// @desc  Summary cards for the dashboard
// @route GET /api/dashboard/summary
const summary = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = startOfNextMonth(now);

  const settings = await Settings.getSingleton();
  // FIX: previously `now + 7*DAY_MS` in the SERVER's timezone. Now uses the
  // same shared, timezone-aware window (Settings.timeZone) as the detailed
  // expiring-memberships list below, so the count card and the list can
  // never disagree.
  const { todayStart, windowEnd: expiringWindowEnd } = getExpiryWindow(settings.timeZone, 7, now);

  const [
    totalMembers,
    activeMembers,
    expiredMembers,
    newMembersThisMonth,
    monthlyGrossRevenueAgg,
    monthlyRefundsAgg,
    monthlyExpenseAgg,
    equipmentCount,
    expiringMembershipsCount,
    pendingPaymentsAgg,
  ] = await Promise.all([
    // NOTE: members are hard-deleted (see memberController.deleteMember), so
    // there is no `isDeleted` flag to filter on anymore — every remaining
    // Member document is, by definition, not deleted. Deleting a member also
    // cascade-deletes their Membership record(s), so a deleted member can
    // never keep contributing to activeMembers / expiringMemberships /
    // pendingPayments below either.
    Member.countDocuments({}),
    Member.countDocuments({ status: 'active' }),
    Member.countDocuments({ status: 'expired' }),
    Member.countDocuments({ joiningDate: { $gte: monthStart, $lt: nextMonthStart } }),
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
    // FIX: uses the shared, timezone-aware expiry window instead of a raw
    // server-clock offset — see utils/membershipExpiry.js.
    Membership.countDocuments({ status: 'active', endDate: { $gte: todayStart, $lt: expiringWindowEnd } }),
    // Every live (active/frozen) membership that still has money owed on it —
    // invoiced minus actually-collected, net of refunds. Nothing auto-bills a
    // membership, so this is the only place that surfaces "who owes what".
    // Deleting a member cascade-deletes their memberships, so this can never
    // include a membership belonging to a member who no longer exists.
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
    membershipsExpiringSoon: expiringMembershipsCount,
    pendingPayments,
    pendingPaymentsCount,
  };

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
      { $match: { joiningDate: { $gte: start, $lt: end } } },
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

// @desc  Detailed list of active memberships expiring within `days` (default
// 7, inclusive) of today, evaluated against the gym's business timezone —
// see utils/membershipExpiry.js, the single shared source of truth for this
// calculation across the dashboard, member/membership pages, and reports.
//
// Kept as its own endpoint rather than folded into /dashboard/summary so the
// lightweight summary payload never carries the full list + per-member
// billing lookups, and so "View All" can page through the full result set
// independently.
// @route GET /api/dashboard/expiring-memberships?days=7&page=1&limit=10
const expiringMemberships = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 10, 100);

  const settings = await Settings.getSingleton();
  const { todayStart, windowEnd } = getExpiryWindow(settings.timeZone, days);

  // Only 'active' memberships count down — a frozen membership's endDate was
  // already pushed out by the freeze itself (see membershipController.
  // freezeMembership), so it isn't "expiring" the same way. This matches the
  // existing summary card and membershipController.expiringSoon, both of
  // which also filter to status: 'active' only.
  const filter = { status: 'active', endDate: { $gte: todayStart, $lt: windowEnd } };

  // Fetched unpaginated-from-Mongo (bounded to a single gym's expiry window,
  // inherently small) so the days-remaining → expiry-date → member-name
  // tie-break sort applies across the WHOLE result set, not just one page.
  // Uses populate() (not $lookup) specifically to avoid the classic
  // aggregation-lookup member-duplication pitfall.
  const memberships = await Membership.find(filter)
    .populate('member', 'memberId firstName lastName phone email')
    .populate('plan', 'name')
    .sort({ endDate: 1 });

  // Defensive: skip anything whose member or plan didn't resolve. A
  // hard-deleted member cascade-deletes their memberships (see
  // memberController.deleteMember), so this should never actually happen —
  // but never surface a broken/orphaned row if it somehow does.
  const valid = memberships.filter((m) => m.member && m.plan);

  const canViewFinance = await hasPermission(req.user, 'finance', 'view');
  // Reuses membershipController's existing billing-summary logic rather than
  // re-deriving outstanding-balance math here.
  const withBilling = canViewFinance ? await attachBillingSummaries(valid) : valid;

  const rows = withBilling
    .map((m) => {
      const daysRemaining = calcDaysRemaining(m.endDate, settings.timeZone);
      return {
        membershipId: m._id,
        memberId: m.member._id,
        memberDisplayId: m.member.memberId,
        memberName: `${m.member.firstName} ${m.member.lastName || ''}`.trim(),
        memberPhone: m.member.phone,
        memberEmail: m.member.email,
        planName: m.plan.name,
        startDate: m.startDate,
        endDate: m.endDate,
        daysRemaining,
        status: m.status,
        expiryStatus: expiryStatusLabel(daysRemaining),
        // Omitted entirely (not just zeroed) for users without finance view
        // permission — JSON.stringify drops `undefined` keys.
        outstanding: canViewFinance ? (m.billing?.outstanding ?? 0) : undefined,
      };
    })
    .sort((a, b) => {
      if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
      const dateDiff = new Date(a.endDate) - new Date(b.endDate);
      if (dateDiff !== 0) return dateDiff;
      return a.memberName.localeCompare(b.memberName);
    });

  const total = rows.length;
  const start = (page - 1) * limit;
  const paged = rows.slice(start, start + limit);

  res.json({
    success: true,
    data: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

module.exports = { summary, charts, expiringMemberships };