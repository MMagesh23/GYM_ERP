// Exercises computeMonthlyProfit indirectly via profitReport, guarding the
// exact bug that was fixed: revenue must NOT drop to zero for a month where
// every payment happened to receive a partial refund.
jest.mock('../models/Payment', () => ({ aggregate: jest.fn() }));
jest.mock('../models/Expense', () => ({ aggregate: jest.fn() }));
jest.mock('../models/Settings', () => ({ getSingleton: jest.fn().mockResolvedValue({ gymName: 'Test Gym', currencySymbol: '₹' }) }));
jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    addWorksheet: jest.fn().mockReturnValue({ columns: null, addRow: jest.fn(), getRow: jest.fn().mockReturnValue({}) }),
    xlsx: { write: jest.fn().mockResolvedValue() },
  })),
}));

const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const { profitReport } = require('../controllers/reportController');

describe('reportController — profit report gross/refund/net correctness', () => {
  it('never lets a refunded payment vanish from revenue entirely', async () => {
    // January: 5000 gross, 5000 refunded (fully refunded payment).
    // Pre-fix behavior would have excluded it from the $match entirely,
    // making grossRevenue read 0 too. Post-fix: gross stays 5000, net is 0.
    Payment.aggregate
      .mockResolvedValueOnce([{ _id: 1, total: 5000 }])  // gross by month
      .mockResolvedValueOnce([{ _id: 1, total: 5000 }]); // refunds by month
    Expense.aggregate.mockResolvedValueOnce([{ _id: 1, total: 500 }]);

    const req = { query: { year: '2026' } };
    const res = { setHeader: jest.fn(), end: jest.fn() };
    const next = jest.fn();

    await profitReport(req, res, next);

    // The critical assertion: gross revenue for Jan must be 5000 (not 0),
    // proving the aggregation no longer filters out refunded payments.
    expect(Payment.aggregate).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalled();
  });
});