const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');

// @desc  Get gym settings (creates default doc on first run)
// @route GET /api/settings
const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  res.json({ success: true, data: settings });
});

// @desc  Update gym settings
// @route PUT /api/settings
const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  Object.assign(settings, req.body);
  await settings.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated gym settings' });

  res.json({ success: true, data: settings });
});

module.exports = { getSettings, updateSettings };
