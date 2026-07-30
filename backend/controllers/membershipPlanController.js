const MembershipPlan = require('../models/MembershipPlan');
const Membership = require('../models/Membership');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');

// Standard duration presets (days). "custom" and "lifetime" are handled specially.
const DURATION_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  half_yearly: 182,
  annual: 365,
  lifetime: 36500, // ~100 years, treated as effectively unlimited
};

// FIX: financial fields on a plan were completely unvalidated. None of these are
// ever exploitable on their own (calcFinalAmount clamps the final price at 0), but
// they're clearly data-entry mistakes that should be rejected outright rather than
// silently producing a nonsense plan that then confuses every membership priced off it.
const validatePlanFinancials = (payload) => {
  const num = (v, fallback = 0) => (v === undefined || v === null || v === '' ? fallback : Number(v));

  if (num(payload.price) < 0) throw new ApiError(400, 'Price cannot be negative.');
  if (num(payload.discount) < 0) throw new ApiError(400, 'Discount cannot be negative.');
  if (payload.discountType === 'percentage' && num(payload.discount) > 100) {
    throw new ApiError(400, 'Percentage discount cannot exceed 100%.');
  }
  if (num(payload.tax) < 0) throw new ApiError(400, 'Tax cannot be negative.');
  if (num(payload.joiningFee) < 0) throw new ApiError(400, 'Joining fee cannot be negative.');
  if (num(payload.freezeDays) < 0) throw new ApiError(400, 'Freeze days cannot be negative.');
  if (num(payload.gracePeriodDays, 3) < 0) throw new ApiError(400, 'Grace period cannot be negative.');
  if (num(payload.maxRenewals) < 0) throw new ApiError(400, 'Max renewals cannot be negative.');
  if (payload.durationType === 'custom' && num(payload.durationDays) <= 0) {
    throw new ApiError(400, 'durationDays must be a positive number for custom plans.');
  }
};

// @desc  List all plans (optionally including inactive ones)
// @route GET /api/membership-plans?includeInactive=true
const listPlans = asyncHandler(async (req, res) => {
  const filter = req.query.includeInactive === 'true' ? {} : { isActive: true };
  const plans = await MembershipPlan.find(filter).sort({ price: 1 });
  res.json({ success: true, data: plans });
});

const getPlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Membership plan not found.');
  res.json({ success: true, data: plan });
});

// @desc  Create a membership plan
// @route POST /api/membership-plans
const createPlan = asyncHandler(async (req, res) => {
  validatePlanFinancials(req.body);

  const payload = { ...req.body };
  if (payload.durationType !== 'custom') {
    payload.durationDays = DURATION_DAYS[payload.durationType];
  } else if (!payload.durationDays) {
    throw new ApiError(400, 'durationDays is required for custom plans.');
  }

  const plan = await MembershipPlan.create(payload);

  await logAudit(req, { action: 'create', module: 'memberships', targetId: plan._id, description: `Created plan "${plan.name}"` });

  res.status(201).json({ success: true, data: plan });
});

// @desc  Update a membership plan
// @route PUT /api/membership-plans/:id
const updatePlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Membership plan not found.');

  // Validate the merged view (existing values + incoming partial update) so a
  // partial PUT can't leave the plan in an invalid state by omitting a field.
  const merged = { ...plan.toObject(), ...req.body };
  validatePlanFinancials(merged);

  const payload = { ...req.body };
  if (payload.durationType && payload.durationType !== 'custom') {
    payload.durationDays = DURATION_DAYS[payload.durationType];
  }

  Object.assign(plan, payload);
  await plan.save();

  await logAudit(req, { action: 'update', module: 'memberships', targetId: plan._id, description: `Updated plan "${plan.name}"` });

  res.json({ success: true, data: plan });
});

// @desc  Delete a membership plan. Replaces the old always-deactivate
// behavior with a real, safe delete:
//   - If the plan has any ACTIVE or FROZEN membership on it right now,
//     deletion is blocked outright — an existing member is still relying
//     on this plan's terms (price, freeze days, renewal cap).
//   - If the plan has no live memberships but DOES have historical ones
//     (expired/cancelled/upgraded/transferred), it is deactivated instead
//     of hard-deleted — historical membership/payment/report records
//     reference this plan by id and must keep resolving correctly.
//   - If the plan has never been used by any membership, it's safe to
//     hard-delete outright.
// @route DELETE /api/membership-plans/:id
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Membership plan not found.');

  const inUse = await Membership.exists({ plan: plan._id, status: { $in: ['active', 'frozen'] } });
  if (inUse) {
    throw new ApiError(
      409,
      'This plan has active or frozen memberships assigned. It cannot be deleted while members are on it — ' +
        'wait for those memberships to end, or move them to a different plan first.'
    );
  }

  const hasHistory = await Membership.exists({ plan: plan._id });
  if (hasHistory) {
    plan.isActive = false;
    await plan.save();

    await logAudit(req, {
      action: 'update',
      module: 'memberships',
      targetId: plan._id,
      description: `Deactivated plan "${plan.name}" (has membership history, so it was deactivated rather than deleted to keep reports accurate)`,
    });

    return res.json({
      success: true,
      data: plan,
      deactivatedInstead: true,
      message: 'This plan has past membership history, so it was deactivated instead of permanently deleted.',
    });
  }

  await plan.deleteOne();

  await logAudit(req, {
    action: 'delete',
    module: 'memberships',
    targetId: plan._id,
    description: `Permanently deleted unused plan "${plan.name}"`,
  });

  res.json({ success: true, message: 'Plan permanently deleted.' });
});

module.exports = { listPlans, getPlan, createPlan, updatePlan, deletePlan, DURATION_DAYS };