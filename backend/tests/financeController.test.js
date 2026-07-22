const { financeSummary } = require('../controllers/financeController');

jest.mock('../models/Payment', () => ({ aggregate: jest.fn() }));
jest.mock('../models/Expense', () => ({ aggregate: jest.fn() }));
jest.mock('../models/Membership', () => ({ aggregate: jest.fn() }));
jest.mock('../models/Settings', () => ({ getSingleton: jest.fn().mockResolvedValue({ currencySymbol: '₹' }) }));

const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Membership = require('../models/Membership');

describe('financeController.financeSummary — gross-minus-refunds correctness', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('nets refunds out of both today and month collection figures, never drops the gross amount', async () => {
    // Simulate: 10,000 gross collected this month, 2,000 of it later refunded.
    // The FIX under test: neither figure should be the pre-fix bug's outcome
    // of silently excluding the whole refunded payment (which would show 0 or
    // a much smaller number here, not 8,000).
    Payment.aggregate
      .mockResolvedValueOnce([{ _id: null, total: 1000 }])  // today gross
      .mockResolvedValueOnce([{ _id: null, total: 0 }])      // today refunds
      .mockResolvedValueOnce([{ _id: null, total: 10000 }])  // month gross
      .mockResolvedValueOnce([{ _id: null, total: 2000 }])   // month refunds
      .mockResolvedValueOnce([])                              // trend gross-by-day
      .mockResolvedValueOnce([])                              // trend refund-by-day
      .mockResolvedValueOnce([]);                             // method breakdown
    Expense.aggregate.mockResolvedValueOnce([]); // trend expense-by-day
    Membership.aggregate.mockResolvedValueOnce([{ _id: null, total: 0, count: 0 }]);

    const req = { query: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await financeSummary(req, res, next);
    await flush();

    const payload = res.json.mock.calls[0][0].data;
    expect(payload.monthCollection).toBe(8000); // 10000 - 2000, NOT 0 and NOT 10000
    expect(payload.todayCollection).toBe(1000);
    expect(next).not.toHaveBeenCalled();
  });
});