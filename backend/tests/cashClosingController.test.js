const cashClosingController = require('../controllers/cashClosingController');

jest.mock('../models/Payment', () => ({ aggregate: jest.fn() }));
jest.mock('../models/Expense', () => ({ aggregate: jest.fn() }));
jest.mock('../utils/logAudit', () => jest.fn());

const CashClosing = require('../models/CashClosing');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');

jest.mock('../models/CashClosing', () => {
  const actualStatics = { normalizeDate: (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; } };
  return { findOne: jest.fn(), findOneAndUpdate: jest.fn(), find: jest.fn(), countDocuments: jest.fn(), ...actualStatics };
});

describe('cashClosingController.closeDrawer', () => {
  const req = (body) => ({ body, user: { _id: 'u1', name: 'Admin' } });
  const flushRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

  beforeEach(() => {
    jest.clearAllMocks();
    Payment.aggregate.mockResolvedValue([{ _id: null, total: 5000 }]);
    Expense.aggregate.mockResolvedValue([{ _id: null, total: 1200 }]);
    CashClosing.findOne.mockResolvedValue(null); // no prior day, opening cash = 0
  });

  it('computes expectedClosingCash as opening + collections - expenses', async () => {
    CashClosing.findOneAndUpdate.mockResolvedValue({ _id: 'c1', expectedClosingCash: 3800, variance: 0 });
    const res = flushRes();
    const next = jest.fn();

    await cashClosingController.closeDrawer(req({ actualClosingCash: 3800 }), res, next);

    expect(CashClosing.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $ne: 'closed' } }),
      expect.objectContaining({
        $set: expect.objectContaining({ expectedClosingCash: 3800, cashCollections: 5000, cashExpenses: 1200, variance: 0 }),
      }),
      expect.objectContaining({ upsert: true })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('requires a varianceReason when actual cash does not match expected', async () => {
    const res = flushRes();
    const next = jest.fn();

    await cashClosingController.closeDrawer(req({ actualClosingCash: 3500 }), res, next);

    // Rejected before ever attempting the atomic write
    expect(CashClosing.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('surfaces a friendly 409 when the atomic write loses a concurrent-close race', async () => {
    const dupError = new Error('duplicate key');
    dupError.code = 11000;
    CashClosing.findOneAndUpdate.mockRejectedValue(dupError);

    const res = flushRes();
    const next = jest.fn();

    await cashClosingController.closeDrawer(req({ actualClosingCash: 3800 }), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, message: expect.stringContaining('already been closed') })
    );
  });
});

describe('cashClosingController.reopenClosing', () => {
  it('requires a reason and flips status back to draft', async () => {
    const mockClosing = { status: 'closed', date: new Date('2026-07-20'), notes: '', save: jest.fn().mockResolvedValue() };
    CashClosing.findOne = jest.fn();
    const CashClosingModel = require('../models/CashClosing');
    CashClosingModel.findById = jest.fn().mockResolvedValue(mockClosing);

    const req = { params: { id: 'c1' }, body: { reason: 'Miscounted till' }, user: { _id: 'u1', name: 'Admin' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await cashClosingController.reopenClosing(req, res, next);

    expect(mockClosing.status).toBe('draft');
    expect(mockClosing.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});