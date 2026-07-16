const { verifyAccessToken } = require('../utils/tokens');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Verifies the Bearer access token and attaches req.user
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) throw new ApiError(401, 'Not authenticated. No token provided.');

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    throw new ApiError(401, 'Session expired or invalid token. Please log in again.');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Account not found or disabled.');
  }

  req.user = user;
  next();
});

// Session timeout: rejects tokens issued before the user's forced-logout timestamp (optional use)
const requireFreshSession = (maxIdleMinutes = 60) =>
  asyncHandler(async (req, res, next) => {
    // Placeholder hook: extend with a lastActivityAt check if you want sliding session timeouts.
    next();
  });

module.exports = { protect, requireFreshSession };
