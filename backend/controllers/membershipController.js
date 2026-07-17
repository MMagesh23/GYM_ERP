const Membership = require('../models/Membership');
const MembershipPlan = require('../models/MembershipPlan');
const Member = require('../models/Member');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');

const DAY_MS = 24 * 60 * 60 * 1000;

// Computes the final payable amount for a plan, applying discount + tax rules.
// isNew controls whether the one-time joining fee is included.
const calcFinalAmount = (plan, { isNew = false, extraDiscount = 0 } = {}) => {
  let amount = plan.price;
  if (isNew) amount += plan.joiningFee || 0;

  const discount = plan.discountType === 'percentage' ? (amount * (plan.discount || 0)) / 100 : plan.discount || 0;
  amount -= discount + extraDiscount;

  const taxAmount = (amount * (plan.tax || 0)) / 100;
  amount += taxAmount;

  return Math.max(Math.round(amount * 100) / 100, 0);
};

// @desc  Start a brand-new membership for a member
// @route POST /api/memberships
// body: { memberId, planId, startDate?, extraDiscount? }
const createMembership = asyncHandler(async (req, res) => {
  const { memberId, planId, startDate, extraDiscount } = req.body;

  const [member, plan] = await Promise.all([Member.findById(memberId), MembershipPlan.findById(planId)]);
  if (!member || member.isDeleted) throw new ApiError(404, 'Member not found.');
  if (!plan || !plan.isActive) throw new ApiError(404, 'Membership plan not found or inactive.');

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

  await logAudit(req, {
    action: 'create',
    module: 'memberships',
    targetId: membership._id,
    description: `New membership (${plan.name}) started for ${member.memberId}`,
  });

  res.status(201).json({ success: true, data: membership });
});

// @desc  Renew the member's current (or a specific) membership on the same plan
// @route POST /api/memberships/:id/renew
const renewMembership = asyncHandler(async (req, res) => {
  const current = await Membership.findById(req.params.id).populate('plan');
  if (!current) throw new ApiError(404, 'Membership not found.');

  const plan = current.plan;
  if (plan.maxRenewals > 0 && current.renewalCount >= plan.maxRenewals) {
    throw new ApiError(400, `This plan allows a maximum of ${plan.maxRenewals} renewal(s).`);
  }

  // Renewal starts the day after the current membership ends (or today if already expired past grace period)
  const graceCutoff = new Date(current.endDate.getTime() + plan.gracePeriodDays * DAY_MS);
  const start = Date.now() > graceCutoff.getTime() ? new Date() : new Date(current.endDate.getTime() + DAY_MS);
  const end = new Date(start.getTime() + plan.durationDays * DAY_MS);

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

  res.status(201).json({ success: true, data: renewal });
});

// @desc  Upgrade or downgrade to a different plan, effective immediately
// @route POST /api/memberships/:id/change-plan
// body: { newPlanId, direction: 'upgrade' | 'downgrade' }
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

  // Pro-rate the switch: remaining days on the old plan become remaining days on the new plan's daily rate
  const now = new Date();
  const remainingMs = Math.max(current.endDate.getTime() - now.getTime(), 0);
  const remainingDays = Math.ceil(remainingMs / DAY_MS);
  const newEnd = new Date(now.getTime() + remainingDays * DAY_MS);

  const changed = await Membership.create({
    member: current.member,
    plan: newPlan._id,
    startDate: now,
    endDate: newEnd,
    status: 'active',
    type: direction,
    previousMembership: current._id,
    finalAmount: calcFinalAmount(newPlan, { isNew: false }),
    createdBy: req.user._id,
  });

  current.status = 'upgraded'; // reused for both upgrade/downgrade transitions
  await current.save();

  await Member.findByIdAndUpdate(current.member, { currentMembership: changed._id });

  await logAudit(req, {
    action: 'update',
    module: 'memberships',
    targetId: changed._id,
    description: `Membership ${direction}d from "${current.plan.name}" to "${newPlan.name}"`,
  });

  res.status(201).json({ success: true, data: changed });
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

  const usedFreezeDays = membership.freezeHistory.reduce((sum, f) => sum + (f.daysUsed || 0), 0);
  if (usedFreezeDays + Number(days) > membership.plan.freezeDays) {
    throw new ApiError(400, `Freeze days exceeded. Plan allows ${membership.plan.freezeDays} total, ${usedFreezeDays} already used.`);
  }

  const from = new Date();
  const to = new Date(from.getTime() + Number(days) * DAY_MS);

  membership.status = 'frozen';
  membership.endDate = new Date(membership.endDate.getTime() + Number(days) * DAY_MS);
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
const unfreezeMembership = asyncHandler(async (req, res) => {
  const membership = await Membership.findById(req.params.id);
  if (!membership) throw new ApiError(404, 'Membership not found.');
  if (membership.status !== 'frozen') throw new ApiError(400, 'Membership is not currently frozen.');

  membership.status = 'active';
  await membership.save();

  await Member.findByIdAndUpdate(membership.member, { status: 'active' });

  await logAudit(req, { action: 'update', module: 'memberships', targetId: membership._id, description: 'Membership unfrozen' });

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
  res.json({ success: true, data: memberships });
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
  calcFinalAmount,
};
