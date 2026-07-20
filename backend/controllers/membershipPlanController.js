const MembershipPlan = require('../models/MembershipPlan');
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

// @desc  Deactivate a plan (soft delete - preserves history for existing memberships)
// @route DELETE /api/membership-plans/:id
const deactivatePlan = asyncHandler(async (req, res) => {
  const plan = await MembershipPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Membership plan not found.');

  plan.isActive = false;
  await plan.save();

  await logAudit(req, { action: 'delete', module: 'memberships', targetId: plan._id, description: `Deactivated plan "${plan.name}"` });

  res.json({ success: true, message: 'Plan deactivated.' });
});

module.exports = { listPlans, getPlan, createPlan, updatePlan, deactivatePlan, DURATION_DAYS };