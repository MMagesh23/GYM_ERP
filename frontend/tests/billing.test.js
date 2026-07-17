const {
  calcFinalAmount,
  calcRenewalWindow,
  calcProratedChangeWindow,
  validateRefundAmount,
  calcFreezeExtension,
  DAY_MS,
} = require('../utils/billing');

describe('calcFinalAmount', () => {
  const basePlan = { price: 1000, joiningFee: 200, discount: 0, discountType: 'flat', tax: 0 };

  test('new member includes joining fee', () => {
    expect(calcFinalAmount(basePlan, { isNew: true })).toBe(1200);
  });

  test('renewal excludes joining fee', () => {
    expect(calcFinalAmount(basePlan, { isNew: false })).toBe(1000);
  });

  test('flat discount is subtracted before tax', () => {
    expect(calcFinalAmount({ ...basePlan, discount: 100 }, { isNew: false })).toBe(900);
  });

  test('percentage discount is applied on the pre-tax amount', () => {
    expect(calcFinalAmount({ ...basePlan, discount: 10, discountType: 'percentage' }, { isNew: false })).toBe(900);
  });

  test('tax is applied after discount', () => {
    // (1000 - 100) * 1.10 = 990
    expect(calcFinalAmount({ ...basePlan, discount: 100, tax: 10 }, { isNew: false })).toBe(990);
  });

  test('extra discount stacks with the plan discount', () => {
    expect(calcFinalAmount({ ...basePlan, discount: 100 }, { isNew: false, extraDiscount: 50 })).toBe(850);
  });

  test('never returns a negative amount even if discounts exceed price', () => {
    expect(calcFinalAmount({ ...basePlan, discount: 5000 }, { isNew: false })).toBe(0);
  });
});

describe('calcRenewalWindow', () => {
  const plan = { durationDays: 30, gracePeriodDays: 3 };

  test('renewal starts the day after the current membership ends, within grace period', () => {
    const now = new Date('2026-06-10T00:00:00Z');
    const current = { endDate: new Date('2026-06-08T00:00:00Z') }; // 2 days ago, within 3-day grace
    const { start, end } = calcRenewalWindow(current, plan, now);
    expect(start.toISOString().slice(0, 10)).toBe('2026-06-09');
    expect(end.getTime() - start.getTime()).toBe(30 * DAY_MS);
  });

  test('late renewal (past grace period) starts today instead of backdating', () => {
    const now = new Date('2026-06-20T00:00:00Z');
    const current = { endDate: new Date('2026-06-01T00:00:00Z') }; // 19 days ago, past grace
    const { start } = calcRenewalWindow(current, plan, now);
    expect(start.toISOString().slice(0, 10)).toBe('2026-06-20');
  });
});

describe('calcProratedChangeWindow', () => {
  test('carries remaining whole days over to the new plan', () => {
    const now = new Date('2026-06-10T00:00:00Z');
    const current = { endDate: new Date('2026-06-15T00:00:00Z') }; // 5 days left
    const { remainingDays, end } = calcProratedChangeWindow(current, now);
    expect(remainingDays).toBe(5);
    expect(end.toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  test('never returns negative remaining days for an already-expired membership', () => {
    const now = new Date('2026-06-20T00:00:00Z');
    const current = { endDate: new Date('2026-06-10T00:00:00Z') };
    expect(calcProratedChangeWindow(current, now).remainingDays).toBe(0);
  });
});

describe('validateRefundAmount', () => {
  const payment = { status: 'paid', finalAmount: 1000, refund: { refundedAmount: 0 } };

  test('allows a partial refund within the paid amount', () => {
    expect(validateRefundAmount(payment, 400).valid).toBe(true);
  });

  test('rejects a refund greater than what was paid', () => {
    expect(validateRefundAmount(payment, 1500).valid).toBe(false);
  });

  test('rejects a zero or negative refund', () => {
    expect(validateRefundAmount(payment, 0).valid).toBe(false);
    expect(validateRefundAmount(payment, -50).valid).toBe(false);
  });

  test('accounts for amounts already refunded', () => {
    const partial = { ...payment, refund: { refundedAmount: 600 } };
    expect(validateRefundAmount(partial, 500).valid).toBe(false); // only 400 left
    expect(validateRefundAmount(partial, 400).valid).toBe(true);
  });

  test('rejects any refund on an already fully-refunded payment', () => {
    expect(validateRefundAmount({ ...payment, status: 'refunded' }, 1).valid).toBe(false);
  });
});

describe('calcFreezeExtension', () => {
  const plan = { freezeDays: 14 };

  test('allows freezing within the plan allowance', () => {
    const membership = { endDate: new Date('2026-06-15T00:00:00Z'), freezeHistory: [] };
    const result = calcFreezeExtension(membership, plan, 7);
    expect(result.valid).toBe(true);
    expect(result.newEndDate.toISOString().slice(0, 10)).toBe('2026-06-22');
  });

  test('rejects freezing beyond the plan allowance, accounting for prior freezes', () => {
    const membership = { endDate: new Date('2026-06-15T00:00:00Z'), freezeHistory: [{ daysUsed: 10 }] };
    expect(calcFreezeExtension(membership, plan, 10).valid).toBe(false); // 10 + 10 > 14
  });
});