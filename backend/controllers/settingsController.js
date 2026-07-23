const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { saveBrandingAsset, deleteBrandingAsset } = require('../utils/fileStorage');


const getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  res.json({ success: true, data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();

  const { features, businessHours, socialLinks, paymentMethods, ...rest } = req.body;
  Object.assign(settings, rest);
  if (features) Object.assign(settings.features, features);
  if (socialLinks) Object.assign(settings.socialLinks, socialLinks);
  if (businessHours) settings.businessHours = businessHours;
  // NEW — sanitize: dedupe, trim, drop blanks, and never allow the list to
  // go empty (would lock out recording any payment/expense at all).
  if (paymentMethods) {
    const cleaned = [...new Set(paymentMethods.map((m) => String(m).trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean))];
    if (cleaned.length === 0) throw new ApiError(400, 'At least one payment method must remain configured.');
    settings.paymentMethods = cleaned;
  }

  await settings.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated gym settings' });

  res.json({ success: true, data: settings });
});

// @desc  Upload/replace the gym logo
// @route POST /api/settings/logo  (multipart, field "logo")
const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No logo file uploaded.');

  const settings = await Settings.getSingleton();
  const previousPublicId = settings.gymLogoPublicId;

  const { url, publicId } = await saveBrandingAsset(req.file, 'branding');
  settings.gymLogo = url;
  settings.gymLogoPublicId = publicId || '';
  await settings.save();

  await deleteBrandingAsset(previousPublicId); // best-effort, non-blocking

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated gym logo' });
  res.json({ success: true, data: settings });
});

const uploadFavicon = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No favicon file uploaded.');

  const settings = await Settings.getSingleton();
  const previousPublicId = settings.faviconPublicId;

  const { url, publicId } = await saveBrandingAsset(req.file, 'branding');
  settings.favicon = url;
  settings.faviconPublicId = publicId || '';
  await settings.save();

  await deleteBrandingAsset(previousPublicId);

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated favicon' });
  res.json({ success: true, data: settings });
});

module.exports = { getSettings, updateSettings, uploadLogo, uploadFavicon };