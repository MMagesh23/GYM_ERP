const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const {
  DAY_MS,
  calcFinalAmount,
  calcRenewalWindow,
  calcPlanChangeAmount,
  calcFreezeExtension,
  calcUnfreezeAdjustment,
  summarizeMembershipBilling,
} = require('../utils/billing');

// Shared by historyForMember and anywhere else that needs "how much of each of
// these memberships has actually been collected" — see utils/billing.js for why
// this can't just be read off Member.status or assumed from finalAmount alone.
const attachBillingSummaries = async (memberships) => {
  const ids = memberships.map((m) => m._id);
  if (ids.length === 0) return memberships;

  const payments = await Payment.find({ membership: { $in: ids } })
    .select('membership finalAmount amountPaid status refund.refundedAmount')
    .lean();

  const byMembership = payments.reduce((acc, p) => {
    const key = String(p.membership);
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});

  return memberships.map((m) => {
    const plain = typeof m.toObject === 'function' ? m.toObject() : m;
    plain.billing = summarizeMembershipBilling(plain.finalAmount, byMembership[String(plain._id)] || []);
    return plain;
  });
};

// @desc  Start a brand-new membership for a member
// @route POST /api/memberships
// body: { memberId, planId, startDate?, extraDiscount? }
const createMembership = asyncHandler(async (req, res) => {
  const { memberId, planId, startDate, extraDiscount } = req.body;

  // FIX: extraDiscount subtracts from the price with no floor of its own —
  // calcFinalAmount clamps the FINAL result at 0, but a negative extraDiscount
  // would silently INCREASE the price above the plan's own price, which is never
  // a legitimate use of a "discount" field.
  if (extraDiscount !== undefined && Number(extraDiscount) < 0) {
    throw new ApiError(400, 'extraDiscount cannot be negative.');
  }

  const [member, plan] = await Promise.all([Member.findById(memberId), MembershipPlan.findById(planId)]);
  if (!member || member.isDeleted) throw new ApiError(404, 'Member not found.');
  if (!plan || !plan.isActive) throw new ApiError(404, 'Membership plan not found or inactive.');

  // A member must not accidentally end up with two live memberships — this guards
  // against silently orphaning an existing active/frozen membership.
  const existing = await Membership.findOne({ member: member._id, status: { $in: ['active', 'frozen'] } });
  if (existing) {
    throw new ApiError(
      409,
      `${member.firstName} already has ${existing.status === 'frozen' ? 'a frozen' : 'an active'} membership. ` +
        'Use renew, change plan, or cancel it before starting a new one.'
    );
  }

  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start.getTime() + plan.durationDays * DAY_MS);

  const membership = await Membership.create({
    member: member._id,
    plan: plan._id,
    startDate: start,
    endDate: end,
    status: 'active',
    type: 'new',
    finalAmount: calcFinalAmount(plan, { isNew: true, extraDiscount }),
    createdBy: req.user._id,
  });

  member.currentMembership = membership._id;
  member.status = 'active';
  await member.save();

  // FIX: a discretionary discount is a financially material override with zero
  // prior audit trail — now recorded explicitly.
  await logAudit(req, {
    action: 'create',
    module: 'memberships',
    targetId: membership._id,
    description:
      `New membership (${plan.name}) started for ${member.memberId}` +
      (Number(extraDiscount) > 0 ? ` with a discretionary discount of ${Number(extraDiscount).toFixed(2)}` : ''),
  });

  // Brand new record — by definition no Payment has ever referenced it yet.
  const membershipWithBilling = membership.toObject();
  membershipWithBilling.billing = summarizeMembershipBilling(membership.finalAmount, []);

  res.status(201).json({ success: true, data: membershipWithBilling });
});

// @desc  Renew the member's current (or a specific) membership on the same plan
// @route POST /api/memberships/:id/renew
const renewMembership = asyncHandler(async (req, res) => {
  const current = await Membership.findById(req.params.id).populate('plan');
  if (!current) throw new ApiError(404, 'Membership not found.');

  // Renewal is only valid from an active membership (the normal case) or an
  // expired one still within reach (grace-period renewal) — a frozen or
  // already-cancelled membership must not be "renewed".
  if (!['active', 'expired'].includes(current.status)) {
    throw new ApiError(400, `Cannot renew a membership with status "${current.status}".`);
  }

  const plan = current.plan;
  if (plan.maxRenewals > 0 && current.renewalCount >= plan.maxRenewals) {
    throw new ApiError(400, `This plan allows a maximum of ${plan.maxRenewals} renewal(s).`);
  }

  // Renewal starts the day after the current membership ends (or today if already
  // past the plan's grace period) — see utils/billing.js for the exact rule + tests.
  const { start, end } = calcRenewalWindow(current, plan);

  const renewal = await Membership.create({
    member: current.member,
    plan: plan._id,
    startDate: start,
    endDate: end,
    status: 'active',
    type: 'renewal',
    previousMembership: current._id,
    renewalCount: current.renewalCount + 1,
    finalAmount: calcFinalAmount(plan, { isNew: false }),
    createdBy: req.user._id,
  });

  current.status = 'expired';
  await current.save();

  await Member.findByIdAndUpdate(current.member, { currentMembership: renewal._id, status: 'active' });

  await logAudit(req, {
    action: 'renewal',
    module: 'memberships',
    targetId: renewal._id,
    description: `Membership renewed (${plan.name})`,
  });

  const renewalWithBilling = renewal.toObject();
  renewalWithBilling.billing = summarizeMembershipBilling(renewal.finalAmount, []);

  res.status(201).json({ success: true, data: renewalWithBilling });
});

// @desc  Upgrade or downgrade to a different plan, effective immediately
// @route POST /api/memberships/:id/change-plan
// body: { newPlanId, direction: 'upgrade' | 'downgrade' }
//
// FIX (overcharge bug): this previously kept the OLD plan's remaining days as the
// ENTIRE new membership window while charging the FULL new-plan price for it — e.g.
// a member with 10 days left on a ₹900/30-day plan upgrading to a ₹36,000/365-day
// plan was charged the full ₹36,000 for only 10 more days. Now: the new membership
// gets a full new-plan duration starting today, and the price charged is the new
// plan's cost minus a credit for the unused value of the old plan (see
// utils/billing.js#calcPlanChangeAmount).
const changePlan = asyncHandler(async (req, res) => {
  const { newPlanId, direction } = req.body;
  if (!['upgrade', 'downgrade'].includes(direction)) {
    throw new ApiError(400, "direction must be 'upgrade' or 'downgrade'");
  }

  const current = await Membership.findById(req.params.id).populate('plan');
  if (!current) throw new ApiError(404, 'Membership not found.');
  if (current.status !== 'active') throw new ApiError(400, 'Only an active membership can be changed.');

  const newPlan = await MembershipPlan.findById(newPlanId);
  if (!newPlan || !newPlan.isActive) throw new ApiError(404, 'Target plan not found or inactive.');

  const now = new Date();
  const { end: newEnd, amountDue, unusedCredit, remainingDays } = calcPlanChangeAmount(current, newPlan, now);

  const changed = await Membership.create({
    member: current.member,
    plan: newPlan._id,
    startDate: now,
    endDate: newEnd,
    status: 'active',
    type: direction,
    previousMembership: current._id,
    finalAmount: amountDue,
    createdBy: req.user._id,
  });

  current.status = 'upgraded'; // reused for both upgrade/downgrade transitions
  await current.save();

  await Member.findByIdAndUpdate(current.member, { currentMembership: changed._id });

  await logAudit(req, {
    action: 'update',
    module: 'memberships',
    targetId: changed._id,
    description:
      `Membership ${direction}d from "${current.plan.name}" to "${newPlan.name}" — ` +
      `${remainingDays} unused day(s) credited (${unusedCredit.toFixed(2)}), ${amountDue.toFixed(2)} charged`,
  });

  const changedWithBilling = changed.toObject();
  changedWithBilling.billing = summarizeMembershipBilling(changed.finalAmount, []);

  res.status(201).json({ success: true, data: changedWithBilling });
});

// @desc  Transfer a membership to a different member (e.g. gifted/sold membership)
// @route POST /api/memberships/:id/transfer
// body: { toMemberId }
const transferMembership = asyncHandler(async (req, res) => {
  const { toMemberId } = req.body;
  const current = await Membership.findById(req.params.id);
  if (!current) throw new ApiError(404, 'Membership not found.');
  if (current.status !== 'active') throw new ApiError(400, 'Only an active membership can be transferred.');

  const toMember = await Member.findById(toMemberId);
  if (!toMember || toMember.isDeleted) throw new ApiError(404, 'Target member not found.');
  if (String(toMember._id) === String(current.member)) {
    throw new ApiError(400, 'Cannot transfer a membership to the same member it already belongs to.');
  }

  // Same active-membership-orphaning guard as createMembership, but on the
  // receiving member — a transfer must not silently bury their existing membership.
  const receiverExisting = await Membership.findOne({ member: toMember._id, status: { $in: ['active', 'frozen'] } });
  if (receiverExisting) {
    throw new ApiError(
      409,
      `${toMember.firstName} already has ${receiverExisting.status === 'frozen' ? 'a frozen' : 'an active'} membership ` +
        'and cannot receive a transferred one until it is resolved.'
    );
  }

  const fromMemberId = current.member;

  const transferred = await Membership.create({
    member: toMember._id,
    plan: current.plan,
    startDate: new Date(),
    endDate: current.endDate,
    status: 'active',
    type: 'transfer',
    previousMembership: current._id,
    finalAmount: 0, // no new charge on transfer; adjust here if a transfer fee is desired
    createdBy: req.user._id,
  });

  current.status = 'transferred';
  await current.save();

  toMember.currentMembership = transferred._id;
  toMember.status = 'active';
  await toMember.save();

  await Member.findByIdAndUpdate(fromMemberId, { currentMembership: null, status: 'cancelled' });

  await logAudit(req, {
    action: 'update',
    module: 'memberships',
    targetId: transferred._id,
    description: `Membership transferred from member ${fromMemberId} to ${toMember.memberId}`,
  });

  res.status(201).json({ success: true, data: transferred });
});

// @desc  Freeze a membership for a number of days, extending its end date
// @route POST /api/memberships/:id/freeze
// body: { days, reason }
const freezeMembership = asyncHandler(async (req, res) => {
  const { days, reason } = req.body;
  if (!days || days <= 0) throw new ApiError(400, 'days must be a positive number.');

  const membership = await Membership.findById(req.params.id).populate('plan');
  if (!membership) throw new ApiError(404, 'Membership not found.');
  if (membership.status !== 'active') throw new ApiError(400, 'Only an active membership can be frozen.');
  if (!membership.plan.freezeAllowed) throw new ApiError(400, 'This plan does not allow freezing.');

  const result = calcFreezeExtension(membership, membership.plan, Number(days));
  if (!result.valid) throw new ApiError(400, result.message);

  const from = new Date();
  const to = result.newEndDate;

  membership.status = 'frozen';
  membership.endDate = result.newEndDate;
  membership.freezeHistory.push({ from, to, reason: reason || '', daysUsed: Number(days) });
  await membership.save();

  await Member.findByIdAndUpdate(membership.member, { status: 'freeze' });

  await logAudit(req, {
    action: 'update',
    module: 'memberships',
    targetId: membership._id,
    description: `Membership frozen for ${days} day(s): ${reason || 'no reason given'}`,
  });

  res.json({ success: true, data: membership });
});

// @desc  Unfreeze a membership, resuming active status
// @route POST /api/memberships/:id/unfreeze
//
// FIX (free-days bug): freezing extended endDate by the full requested days
// immediately, and this endpoint never adjusted anything back — so a member could
// request the max freeze allowance, unfreeze the next day, and permanently keep
// the whole extension. Now: if the member unfreezes before using the full
// requested freeze period, the unused portion of the extension is clawed back
// from endDate, and the freeze-allowance ledger (daysUsed) is reduced to match
// what was actually used — see utils/billing.js#calcUnfreezeAdjustment.
const unfreezeMembership = asyncHandler(async (req, res) => {
  const membership = await Membership.findById(req.params.id);
  if (!membership) throw new ApiError(404, 'Membership not found.');
  if (membership.status !== 'frozen') throw new ApiError(400, 'Membership is not currently frozen.');

  const lastFreeze = membership.freezeHistory[membership.freezeHistory.length - 1];
  let clawbackNote = '';

  if (lastFreeze && !lastFreeze.actualTo) {
    const now = new Date();
    const { newEndDate, adjustedDaysUsed, unusedDaysClawedBack } = calcUnfreezeAdjustment(lastFreeze, membership.endDate, now);
    if (unusedDaysClawedBack > 0) {
      membership.endDate = newEndDate;
      lastFreeze.daysUsed = adjustedDaysUsed;
      clawbackNote = ` (returned early — ${unusedDaysClawedBack} unused freeze day(s) credited back to the plan allowance)`;
    }
    lastFreeze.actualTo = now;
  }

  membership.status = 'active';
  await membership.save();

  await Member.findByIdAndUpdate(membership.member, { status: 'active' });

  await logAudit(req, {
    action: 'update',
    module: 'memberships',
    targetId: membership._id,
    description: `Membership unfrozen${clawbackNote}`,
  });

  res.json({ success: true, data: membership });
});

// @desc  Cancel a membership outright
// @route POST /api/memberships/:id/cancel
const cancelMembership = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const membership = await Membership.findById(req.params.id);
  if (!membership) throw new ApiError(404, 'Membership not found.');

  membership.status = 'cancelled';
  await membership.save();

  await Member.findByIdAndUpdate(membership.member, { status: 'cancelled', currentMembership: null });

  await logAudit(req, {
    action: 'update',
    module: 'memberships',
    targetId: membership._id,
    description: `Membership cancelled: ${reason || 'no reason given'}`,
  });

  res.json({ success: true, data: membership });
});

// @desc  Memberships expiring within N days (for reminders / dashboard)
// @route GET /api/memberships/expiring?days=7
const expiringSoon = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 7;
  const now = new Date();
  const until = new Date(now.getTime() + days * DAY_MS);

  const memberships = await Membership.find({
    status: 'active',
    endDate: { $gte: now, $lte: until },
  })
    .populate('member', 'memberId firstName lastName phone email')
    .populate('plan', 'name')
    .sort({ endDate: 1 });

  res.json({ success: true, data: memberships });
});

// @desc  Full membership history for a given member
// @route GET /api/memberships/member/:memberId
const historyForMember = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ member: req.params.memberId })
    // Populate the full plan document (not just name/durationType/price) so the
    // freeze/change-plan/transfer UI has freezeDays, freezeAllowed, joiningFee,
    // discount, and tax available regardless of which history record it opened from.
    .populate('plan')
    .sort({ createdAt: -1 });
  const withBilling = await attachBillingSummaries(memberships);
  res.json({ success: true, data: withBilling });
});

// @desc  Every live (active/frozen) membership that still has money owed on it —
// i.e. finalAmount not fully covered by linked Payment records. Since nothing
// auto-bills a membership, this is the only place that surfaces the full list of
// "who owes what" in one screen, instead of hunting member-by-member.
// @route GET /api/memberships/outstanding
const outstandingMemberships = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ status: { $in: ['active', 'frozen'] } })
    .populate('member', 'memberId firstName lastName phone email')
    .populate('plan', 'name')
    .sort({ createdAt: -1 });

  const withBilling = await attachBillingSummaries(memberships);
  const outstanding = withBilling
    .filter((m) => m.billing.outstanding > 0)
    .sort((a, b) => b.billing.outstanding - a.billing.outstanding);

  res.json({ success: true, data: outstanding });
});

module.exports = {
  createMembership,
  renewMembership,
  changePlan,
  transferMembership,
  freezeMembership,
  unfreezeMembership,
  cancelMembership,
  expiringSoon,
  historyForMember,
  outstandingMemberships,
  calcFinalAmount, // re-exported from utils/billing for backward compatibility with any existing imports
};