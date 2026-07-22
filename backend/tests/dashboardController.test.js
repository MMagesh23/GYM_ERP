const dashboardController = require('../controllers/dashboardController');

jest.mock('../models/Settings', () => ({
  getSingleton: jest.fn().mockResolvedValue({ dashboardWidgets: { admin: ['totalMembers', 'monthlyRevenue', 'monthlyExpenses', 'netProfit', 'equipmentCount', 'membershipsExpiringSoon', 'pendingPayments', 'revenueChart', 'membershipGrowthChart', 'profitChart', 'planDistributionChart'] } }),
}));

jest.mock('../models/Member', () => ({
  countDocuments: jest.fn().mockResolvedValue(12),
  aggregate: jest.fn().mockResolvedValue([{ _id: 1, count: 2 }, { _id: 2, count: 3 }]),
}));

jest.mock('../models/Membership', () => ({
  countDocuments: jest.fn().mockResolvedValue(7),
  // Two different aggregations run through Membership.aggregate: the dashboard's
  // pending-payments rollup (joins against payments) and the plan-distribution
  // chart (joins against membershipplans) — branch on which $lookup is present.
  aggregate: jest.fn((pipeline) => {
    const lookupStage = pipeline.find((s) => s.$lookup);
    if (lookupStage?.$lookup?.from === 'payments') {
      return Promise.resolve([{ _id: null, total: 5400, count: 3 }]);
    }
    return Promise.resolve([{ _id: 'Gold', count: 4 }]);
  }),
}));

jest.mock('../models/MembershipPlan', () => ({}));

// FIX: previously a single static mockResolvedValue returned the SAME
// {total: 1000} result for every Payment.aggregate call — but
// dashboardController.summary() calls Payment.aggregate TWICE (gross revenue,
// then refunds, per the gross-minus-refunds accounting model in
// utils/financeCalculations.js). With one shared value, the refunds query
// picked up the same total as the gross query, silently netting revenue to
// zero and profit negative — a bug in this test file, not in the controller.
// This now inspects the pipeline's $match stage to tell the two queries
// apart, the same way the real aggregation distinguishes them.
jest.mock('../models/Payment', () => ({
  aggregate: jest.fn((pipeline) => {
    const matchStage = pipeline.find((s) => s.$match)?.$match || {};
    const isRefundQuery = Object.prototype.hasOwnProperty.call(matchStage, 'refund.refundDate');
    if (isRefundQuery) {
      // No refunds in this fixture, so net revenue should equal gross revenue.
      return Promise.resolve([]);
    }
    return Promise.resolve([{ _id: 1, total: 1000 }, { _id: 2, total: 2000 }]);
  }),
}));

jest.mock('../models/Expense', () => ({
  aggregate: jest.fn().mockResolvedValue([{ _id: null, total: 700 }]),
}));

jest.mock('../models/Equipment', () => ({
  countDocuments: jest.fn().mockResolvedValue(9),
}));

describe('dashboard controller', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('returns a populated summary payload', async () => {
    const req = { user: { role: 'admin' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    dashboardController.summary(req, res, next);
    await flush();

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          totalMembers: 12,
          monthlyRevenue: 1000,
          monthlyExpenses: 700,
          netProfit: 300,
          equipmentCount: 9,
          membershipsExpiringSoon: 7,
          pendingPayments: 5400,
          pendingPaymentsCount: 3,
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns structured chart datasets', async () => {
    const req = { query: { year: 2026 }, user: { role: 'admin' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    dashboardController.charts(req, res, next);
    await flush();

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          year: 2026,
          revenueByMonth: expect.any(Array),
          membershipGrowth: expect.any(Array),
          profitByMonth: expect.any(Array),
          planDistribution: expect.arrayContaining([
            expect.objectContaining({ plan: 'Gold', count: 4 }),
          ]),
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});