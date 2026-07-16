const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { saveBufferToUploads } = require('../utils/fileStorage');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  res.json({ success: true, data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();

  // Deep-merge nested objects instead of clobbering them
  const { features, businessHours, socialLinks, ...rest } = req.body;
  Object.assign(settings, rest);
  if (features) Object.assign(settings.features, features);
  if (socialLinks) Object.assign(settings.socialLinks, socialLinks);
  if (businessHours) settings.businessHours = businessHours;

  await settings.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated gym settings' });

  res.json({ success: true, data: settings });
});

// @desc  Upload/replace the gym logo
// @route POST /api/settings/logo  (multipart, field "logo")
const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No logo file uploaded.');

  const settings = await Settings.getSingleton();
  settings.gymLogo = saveBufferToUploads(req.file, 'branding');
  await settings.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated gym logo' });

  res.json({ success: true, data: settings });
});

// @desc  Upload/replace the favicon
// @route POST /api/settings/favicon
const uploadFavicon = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No favicon file uploaded.');

  const settings = await Settings.getSingleton();
  settings.favicon = saveBufferToUploads(req.file, 'branding');
  await settings.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated favicon' });

  res.json({ success: true, data: settings });
});

module.exports = { getSettings, updateSettings, uploadLogo, uploadFavicon };