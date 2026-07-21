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

// A membership's `finalAmount` is what's owed; it is NEVER auto-billed — nothing
// creates a Payment record when a membership is assigned/renewed/changed. That gap
// used to be invisible: the UI only showed billing info sourced from the Payments
// list, so a membership with zero payment records (the common case right after
// assigning one) looked "fully settled" everywhere — profile stat cards, the
// member list, the dashboard — when in fact nothing had been collected yet.
//
// This is the single source of truth for "how much of this membership has been
// collected", computed straight from finalAmount + whatever Payment records
// actually reference it (never assumed). Every surface that shows membership
// billing status (member list, member profile, membership timeline, dashboard)
// should go through this so they can never disagree with each other.
const BILLING_STATUS = {
  UNBILLED: 'unbilled', // finalAmount is 0 (e.g. a transfer) — nothing to collect
  UNPAID: 'unpaid', // nothing collected yet, including "no payment record exists at all"
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERPAID: 'overpaid', // collected more than invoiced (extra payment, or a discount applied after collection)
};

const summarizeMembershipBilling = (finalAmount, payments = []) => {
  const invoiced = Math.round((Number(finalAmount) || 0) * 100) / 100;

  const collected = payments.reduce((sum, p) => {
    if (p.status === 'failed') return sum; // nothing was ever received
    const paid = p.amountPaid ?? p.finalAmount ?? 0;
    const refunded = p.refund?.refundedAmount || 0;
    return sum + Math.max(paid - refunded, 0);
  }, 0);
  const roundedCollected = Math.round(collected * 100) / 100;
  const outstanding = Math.max(Math.round((invoiced - roundedCollected) * 100) / 100, 0);

  let status;
  if (invoiced <= 0) {
    status = roundedCollected > 0 ? BILLING_STATUS.OVERPAID : BILLING_STATUS.UNBILLED;
  } else if (roundedCollected <= 0) {
    status = BILLING_STATUS.UNPAID;
  } else if (roundedCollected < invoiced) {
    status = BILLING_STATUS.PARTIAL;
  } else {
    status = roundedCollected > invoiced ? BILLING_STATUS.OVERPAID : BILLING_STATUS.PAID;
  }

  return { invoiced, collected: roundedCollected, outstanding, status };
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
  BILLING_STATUS,
  summarizeMembershipBilling,
};