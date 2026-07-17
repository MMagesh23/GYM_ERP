const DAY_MS = 24 * 60 * 60 * 1000;

const calcFinalAmount = (plan, { isNew = false, extraDiscount = 0 } = {}) => {
  let amount = plan.price;
  if (isNew) amount += plan.joiningFee || 0;

  const discount = plan.discountType === 'percentage' ? (amount * (plan.discount || 0)) / 100 : plan.discount || 0;
  amount -= discount + extraDiscount;

  const taxAmount = (amount * (plan.tax || 0)) / 100;
  amount += taxAmount;

  return Math.max(Math.round(amount * 100) / 100, 0);
};

const calcRenewalWindow = (current, plan, now = new Date()) => {
  const graceCutoff = new Date(current.endDate.getTime() + plan.gracePeriodDays * DAY_MS);
  const start = now.getTime() > graceCutoff.getTime() ? new Date(now) : new Date(current.endDate.getTime() + DAY_MS);
  const end = new Date(start.getTime() + plan.durationDays * DAY_MS);
  return { start, end };
};

const calcProratedChangeWindow = (current, now = new Date()) => {
  const remainingMs = Math.max(current.endDate.getTime() - now.getTime(), 0);
  const remainingDays = Math.ceil(remainingMs / DAY_MS);
  const end = new Date(now.getTime() + remainingDays * DAY_MS);
  return { start: new Date(now), end, remainingDays };
};

const validateRefundAmount = (payment, requestedAmount) => {
  if (payment.status === 'refunded') {
    return { valid: false, message: 'This payment has already been fully refunded.' };
  }
  const alreadyRefunded = payment.refund?.refundedAmount || 0;
  const remaining = payment.finalAmount - alreadyRefunded;

  if (!(requestedAmount > 0) || requestedAmount > remaining) {
    return { valid: false, message: 'Refund amount must be positive and not exceed the remaining paid amount.' };
  }
  return { valid: true, remaining };
};

const calcFreezeExtension = (membership, plan, requestedDays) => {
  const usedFreezeDays = (membership.freezeHistory || []).reduce((sum, f) => sum + (f.daysUsed || 0), 0);
  if (usedFreezeDays + requestedDays > plan.freezeDays) {
    return { valid: false, message: `Freeze days exceeded. Plan allows ${plan.freezeDays} total, ${usedFreezeDays} already used.` };
  }
  const newEndDate = new Date(membership.endDate.getTime() + requestedDays * DAY_MS);
  return { valid: true, newEndDate, usedFreezeDays };
};

module.exports = { DAY_MS, calcFinalAmount, calcRenewalWindow, calcProratedChangeWindow, validateRefundAmount, calcFreezeExtension };