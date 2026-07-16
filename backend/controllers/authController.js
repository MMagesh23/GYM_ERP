const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
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
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

  // Successful login - reset lockout counters
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  user.lastLoginIP = req.ip;

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

  await logAudit(req, { action: 'login', module: 'auth', targetId: user._id, description: `${user.email} logged in` });

  res.json({ success: true, data: { user, accessToken } });
});

// @desc  Exchange a valid refresh token (httpOnly cookie) for a new access token
// @route POST /api/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token provided.');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    throw new ApiError(401, 'Refresh token invalid or expired. Please log in again.');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled.');

  if (user.refreshTokenHash !== hashToken(token)) {
    // Token reuse detected (rotation mismatch) - force logout everywhere
    user.refreshTokenHash = null;
    await user.save();
    throw new ApiError(401, 'Refresh token has been invalidated. Please log in again.');
  }

  // Rotate refresh token
  const newRefreshToken = generateRefreshToken(user);
  user.refreshTokenHash = hashToken(newRefreshToken);
  await user.save();

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
      await User.findByIdAndUpdate(decoded.sub, { refreshTokenHash: null });
    } catch (err) {
      // token already invalid/expired - nothing to clean up
    }
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });

  if (req.user) {
    await logAudit(req, { action: 'logout', module: 'auth', targetId: req.user._id, description: `${req.user.email} logged out` });
  }

  res.json({ success: true, message: 'Logged out successfully.' });
});

// @desc  Get current authenticated user
// @route GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = { register, login, refresh, logout, me };
