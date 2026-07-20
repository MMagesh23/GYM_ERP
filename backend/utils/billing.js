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

// LEGACY — kept only so nothing importing it directly breaks. No longer used for
// pricing a plan change (see calcPlanChangeAmount below for why: this function only
// carried over the OLD plan's remaining days as the new membership's entire window,
// while the caller charged the FULL new-plan price for that short window — a real
// overcharge bug). Do not wire this back into changePlan().
const calcProratedChangeWindow = (current, now = new Date()) => {
  const remainingMs = Math.max(current.endDate.getTime() - now.getTime(), 0);
  const remainingDays = Math.ceil(remainingMs / DAY_MS);
  const end = new Date(now.getTime() + remainingDays * DAY_MS);
  return { start: new Date(now), end, remainingDays };
};

/**
 * FIX (overcharge bug): pricing a plan change now works like a real upgrade/downgrade:
 * - The new membership gets a FULL new-plan duration starting today (not just the
 *   old plan's leftover days).
 * - The price charged is the new plan's cost MINUS a credit for the unused value of
 *   the old plan, never less than zero.
 * - The old plan's daily rate is computed off the CURRENT membership record's actual
 *   start→end span (current.finalAmount / actualPeriodDays), not the plan's nominal
 *   durationDays, so this stays correct even when `current` is itself already the
 *   result of a previous prorated change or a frozen/extended membership.
 */
const calcPlanChangeAmount = (current, newPlan, now = new Date()) => {
  const remainingMs = Math.max(current.endDate.getTime() - now.getTime(), 0);
  const remainingDays = Math.ceil(remainingMs / DAY_MS);

  const actualPeriodDays = Math.max(
    Math.round((current.endDate.getTime() - current.startDate.getTime()) / DAY_MS),
    1
  );
  const oldPlanDailyRate = current.finalAmount / actualPeriodDays;
  const unusedCredit = Math.round(oldPlanDailyRate * remainingDays * 100) / 100;

  const newPlanCost = calcFinalAmount(newPlan, { isNew: false });
  const amountDue = Math.max(Math.round((newPlanCost - unusedCredit) * 100) / 100, 0);

  const start = new Date(now);
  const end = new Date(start.getTime() + newPlan.durationDays * DAY_MS);

  return { start, end, remainingDays, unusedCredit, newPlanCost, amountDue };
};

// FIX: refunds must be capped against what was actually COLLECTED (amountPaid),
// not the invoiced total (finalAmount) — a 'partial' payment previously allowed
// refunding more money than was ever received. Also blocks refunding a payment
// whose status shows nothing was ever collected ('pending' / 'failed').
const REFUNDABLE_STATUSES = ['paid', 'partial', 'partially_refunded'];

const validateRefundAmount = (payment, requestedAmount) => {
  if (!REFUNDABLE_STATUSES.includes(payment.status)) {
    return {
      valid: false,
      message: `Cannot refund a payment with status "${payment.status}" — only money that was actually collected can be refunded.`,
    };
  }
  // amountPaid ?? finalAmount: fallback for payment records created before the
  // amountPaid field existed (see utils/migrateAmountPaid.js for the backfill).
  const collected = payment.amountPaid ?? payment.finalAmount;
  const alreadyRefunded = payment.refund?.refundedAmount || 0;
  const remaining = collected - alreadyRefunded;

  if (!(requestedAmount > 0) || requestedAmount > remaining) {
    return {
      valid: false,
      message: `Refund amount must be positive and not exceed the amount actually collected (${remaining.toFixed(2)} remaining).`,
    };
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

/**
 * FIX (free-days bug): freezeMembership() previously extended endDate by the FULL
 * requested days immediately, and unfreezeMembership() never adjusted anything back —
 * so a member could request the max freeze allowance, unfreeze the next day, and
 * permanently keep the whole extension. This computes what to claw back when the
 * member unfreezes before using their full requested freeze period.
 *
 * @param {{from: Date, daysUsed: number}} lastFreezeEntry - the freezeHistory entry for the freeze currently in effect
 * @param {Date} currentEndDate - membership.endDate as it stands right now (already extended by the freeze)
 * @param {Date} now - when the unfreeze is happening
 */
const calcUnfreezeAdjustment = (lastFreezeEntry, currentEndDate, now = new Date()) => {
  const requestedDays = lastFreezeEntry.daysUsed;
  const actualDaysFrozen = Math.max(
    1,
    Math.ceil((now.getTime() - new Date(lastFreezeEntry.from).getTime()) / DAY_MS)
  );

  if (actualDaysFrozen >= requestedDays) {
    return { newEndDate: currentEndDate, adjustedDaysUsed: requestedDays, unusedDaysClawedBack: 0 };
  }

  const unusedDays = requestedDays - actualDaysFrozen;
  return {
    newEndDate: new Date(currentEndDate.getTime() - unusedDays * DAY_MS),
    adjustedDaysUsed: actualDaysFrozen,
    unusedDaysClawedBack: unusedDays,
  };
};

module.exports = {
  DAY_MS,
  calcFinalAmount,
  calcRenewalWindow,
  calcProratedChangeWindow,
  calcPlanChangeAmount,
  validateRefundAmount,
  calcFreezeExtension,
  calcUnfreezeAdjustment,
};