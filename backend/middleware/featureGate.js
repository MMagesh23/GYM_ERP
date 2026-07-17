const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Usage: router.use(requireFeature('equipmentModule'))
const requireFeature = (featureKey) =>
  asyncHandler(async (req, res, next) => {
    const settings = await Settings.getSingleton();
    if (settings.features?.[featureKey] === false) {
      throw new ApiError(403, 'This module is disabled in Settings.');
    }
    next();
  });

module.exports = { requireFeature };