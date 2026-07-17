const crypto = require('crypto');
const Staff = require('../models/Staff');
const User = require('../models/User');
const Session = require('../models/Session');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { generateEntityId } = require('../utils/idGenerator');
const { saveBufferToUploads } = require('../utils/fileStorage');

// @desc  List staff (receptionists) with search + pagination
// @route GET /api/staff?page=&limit=&q=&status=
const listStaff = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { q, status } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { mobile: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { employeeId: { $regex: q, $options: 'i' } },
    ];
  }

  const [staff, total] = await Promise.all([
    Staff.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Staff.countDocuments(filter),
  ]);

  res.json({ success: true, data: staff, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

const createStaff = asyncHandler(async (req, res) => {
  const { createLogin, password, roleRef, ...body } = req.body;
  const employeeId = await generateEntityId('employeeId', 'EMP', 3);

  const payload = { ...body, employeeId };
  if (req.file) payload.photo = await saveBufferToUploads(req.file, 'staff');

  const staff = await Staff.create(payload);

  let generatedPassword;
  if (createLogin === 'true' || createLogin === true) {
    if (!body.email) throw new ApiError(400, 'Email is required to create a login account.');
    const existing = await User.findOne({ email: body.email });
    if (existing) throw new ApiError(409, 'A user with this email already exists.');

    generatedPassword = password || crypto.randomBytes(6).toString('hex');
    const user = new User({
      name: body.name,
      email: body.email,
      phone: body.mobile,
      role: 'receptionist',
      roleRef: roleRef || undefined,
      staffProfile: staff._id,
    });
    await user.setPassword(generatedPassword);
    await user.save();

    staff.user = user._id;
    await staff.save();
  }

  await logAudit(req, {
    action: 'create',
    module: 'staff',
    targetId: staff._id,
    description: `Added staff ${staff.employeeId} (${staff.name})${staff.user ? ' with login account' : ''}`,
  });

  res.status(201).json({ success: true, data: staff, temporaryPassword: generatedPassword });
});

const updateStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) throw new ApiError(404, 'Staff member not found.');

  const { employeeId, roleRef, ...updates } = req.body;
  Object.assign(staff, updates);
  if (req.file) staff.photo = await saveBufferToUploads(req.file, 'staff');
  await staff.save();

  // Keep the linked login account's contact info (and optionally custom role) in sync
  if (staff.user) {
    const userUpdates = { name: staff.name, phone: staff.mobile };
    if (roleRef !== undefined) userUpdates.roleRef = roleRef || null;
    await User.findByIdAndUpdate(staff.user, userUpdates);
  }

  await logAudit(req, { action: 'update', module: 'staff', targetId: staff._id, description: `Updated staff ${staff.employeeId}` });

  res.json({ success: true, data: staff });
});

const getStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id).populate({
    path: 'user',
    select: 'email isActive lastLoginAt roleRef',
    populate: { path: 'roleRef', select: 'name' },
  });
  if (!staff) throw new ApiError(404, 'Staff member not found.');
  res.json({ success: true, data: staff });
});

// @desc  Enable or disable a staff member's account
// @route PATCH /api/staff/:id/disable
// body: { disable: boolean }
const toggleDisable = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) throw new ApiError(404, 'Staff member not found.');

  const disable = req.body.disable !== false; // default true
  staff.status = disable ? 'disabled' : 'active';
  await staff.save();

  if (staff.user) {
    await User.findByIdAndUpdate(staff.user, { isActive: !disable });
  }

  await logAudit(req, {
    action: 'update',
    module: 'staff',
    targetId: staff._id,
    description: `Staff ${staff.employeeId} ${disable ? 'disabled' : 're-enabled'}`,
  });

  res.json({ success: true, data: staff });
});

// @desc  Reset a staff member's login password (admin-issued)
// @route POST /api/staff/:id/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) throw new ApiError(404, 'Staff member not found.');
  if (!staff.user) throw new ApiError(400, 'This staff member does not have a login account.');

  const newPassword = req.body.password || crypto.randomBytes(6).toString('hex');
  const user = await User.findById(staff.user);
  if (!user) throw new ApiError(404, 'Linked user account not found.');

  await user.setPassword(newPassword);
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  // Force re-login everywhere: revoke every active session tied to this user
  await Session.updateMany(
    { user: user._id, revoked: false },
    { revoked: true, revokedAt: new Date(), revokedReason: 'password_reset' }
  );

  await logAudit(req, {
    action: 'update',
    module: 'staff',
    targetId: staff._id,
    description: `Password reset for staff ${staff.employeeId} (all sessions revoked)`,
  });

  res.json({ success: true, message: 'Password reset.', temporaryPassword: newPassword });
});

module.exports = { listStaff, getStaff, createStaff, updateStaff, toggleDisable, resetPassword };
