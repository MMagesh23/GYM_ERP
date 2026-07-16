const User = require('../models/User');
const Session = require('../models/Session');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { parseDeviceLabel } = require('../utils/deviceLabel');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/tokens');

const MAX_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCK_MINUTES = Number(process.env.LOCK_TIME_MINUTES) || 15;

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

// @desc  Register a new user (admin-only in practice; gate with authorize('admin') in routes)
// @route POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'A user with this email already exists.');

  const user = new User({ name, email, phone, role: role || 'receptionist' });
  await user.setPassword(password);
  await user.save();

  await logAudit(req, { action: 'create', module: 'users', targetId: user._id, description: `Created user ${email}` });

  res.status(201).json({ success: true, data: user });
});

// @desc  Login with email + password
// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  if (user.isLocked) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(423, `Account locked due to repeated failed logins. Try again in ${minutesLeft} minute(s).`);
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been disabled. Contact your administrator.');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= MAX_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      user.loginAttempts = 0;
    }
    await user.save();
    throw new ApiError(401, 'Invalid email or password.');
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  user.lastLoginIP = req.ip;
  await user.save();

  // Build the session in memory first (Mongoose assigns _id immediately,
  // no DB round-trip needed), THEN generate the token that references it,
  // THEN save once, fully populated. Avoids the two-phase-save validation issue.
  const session = new Session({
    user: user._id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || '',
    deviceLabel: parseDeviceLabel(req.headers['user-agent'] || ''),
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, session._id.toString());
  session.refreshTokenHash = hashToken(refreshToken);
  await session.save();

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

  await logAudit(req, {
    action: 'login',
    module: 'auth',
    targetId: user._id,
    description: `${user.email} logged in (${session.deviceLabel})`,
  });

  res.json({ success: true, data: { user, accessToken } });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token provided.');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    throw new ApiError(401, 'Refresh token invalid or expired. Please log in again.');
  }

  const [user, session] = await Promise.all([
    User.findById(decoded.sub),
    Session.findById(decoded.sid),
  ]);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled.');
  if (!session || session.revoked) throw new ApiError(401, 'Session has been revoked. Please log in again.');

  if (session.refreshTokenHash !== hashToken(token)) {
    // Reuse of a rotated-out token = compromised session. Kill it.
    session.revoked = true;
    session.revokedAt = new Date();
    session.revokedReason = 'reuse_detected';
    await session.save();
    throw new ApiError(401, 'Refresh token has been invalidated. Please log in again.');
  }

  const newRefreshToken = generateRefreshToken(user, session._id.toString());
  session.refreshTokenHash = hashToken(newRefreshToken);
  session.lastActiveAt = new Date();
  session.ipAddress = req.ip;
  await session.save();

  res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTS);

  const accessToken = generateAccessToken(user);
  res.json({ success: true, data: { accessToken } });
});


// @desc  Logout - invalidate refresh token
// @route POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      await Session.findByIdAndUpdate(decoded.sid, { revoked: true, revokedAt: new Date(), revokedReason: 'logout' });
    } catch (err) {
      // token already invalid - nothing to clean up
    }
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });

  if (req.user) {
    await logAudit(req, { action: 'logout', module: 'auth', targetId: req.user._id, description: `${req.user.email} logged out` });
  }

  res.json({ success: true, message: 'Logged out successfully.' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

// @desc  List the current user's active (non-revoked) sessions
// @route GET /api/auth/sessions
const listMySessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ user: req.user._id, revoked: false }).sort({ lastActiveAt: -1 });
  res.json({ success: true, data: sessions });
});

// @desc  Revoke a specific session (e.g. "log out this device")
// @route DELETE /api/auth/sessions/:id
const revokeSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, user: req.user._id });
  if (!session) throw new ApiError(404, 'Session not found.');

  session.revoked = true;
  session.revokedAt = new Date();
  session.revokedReason = 'manual_revoke';
  await session.save();

  await logAudit(req, { action: 'update', module: 'auth', targetId: session._id, description: `Revoked session (${session.deviceLabel})` });

  res.json({ success: true, message: 'Session revoked.' });
});

// @desc  Revoke every session except the current one ("log out other devices")
// @route POST /api/auth/sessions/revoke-others
const revokeOtherSessions = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  const decoded = token ? verifyRefreshToken(token) : null;
  const currentSessionId = decoded?.sid;

  await Session.updateMany(
    { user: req.user._id, revoked: false, _id: { $ne: currentSessionId } },
    { revoked: true, revokedAt: new Date(), revokedReason: 'manual_revoke' }
  );

  await logAudit(req, { action: 'update', module: 'auth', targetId: req.user._id, description: 'Revoked all other sessions' });

  res.json({ success: true, message: 'All other sessions revoked.' });
});

// @desc  Admin: view active sessions for any user (useful for security investigations)
// @route GET /api/auth/sessions/user/:userId
const listUserSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ user: req.params.userId }).sort({ lastActiveAt: -1 }).limit(50);
  res.json({ success: true, data: sessions });
});

// @desc  Change the logged-in user's own password
// @route PUT /api/auth/change-password
// body: { currentPassword, newPassword }
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required.');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters.');
  }

  const user = await User.findById(req.user._id);
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(401, 'Current password is incorrect.');

  await user.setPassword(newPassword);
  await user.save();

  // Revoke every other session so a leaked old password can't keep a device logged in
  const token = req.cookies?.refreshToken;
  let currentSessionId = null;
  if (token) {
    try {
      currentSessionId = verifyRefreshToken(token).sid;
    } catch (err) {
      // ignore - falls through to revoking everything
    }
  }
  await Session.updateMany(
    { user: user._id, revoked: false, _id: { $ne: currentSessionId } },
    { revoked: true, revokedAt: new Date(), revokedReason: 'password_change' }
  );

  await logAudit(req, { action: 'update', module: 'auth', targetId: user._id, description: `${user.email} changed their password` });

  res.json({ success: true, message: 'Password changed successfully.' });
});

module.exports = {
  register, login, refresh, logout, me,
  listMySessions, revokeSession, revokeOtherSessions, listUserSessions, changePassword,
};