const EmailSettings = require('../models/EmailSettings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const logAudit = require('../utils/logAudit');
const { verifyConnection, sendRawEmail } = require('../utils/emailService');

// @desc  Get current email configuration (App Password never returned - only
//        whether one is set, via the hasAppPassword virtual)
// @route GET /api/email-settings
const getEmailSettings = asyncHandler(async (req, res) => {
  const settings = await EmailSettings.getSingleton();
  res.json({ success: true, data: settings });
});

// @desc  Update Gmail email configuration
// @route PUT /api/email-settings
// body: { gmailAddress?, appPassword?, senderName?, replyTo?, enabled? }
const updateEmailSettings = asyncHandler(async (req, res) => {
  const { gmailAddress, appPassword, senderName, replyTo, enabled } = req.body;

  const settings = await EmailSettings.getSingleton();

  if (gmailAddress !== undefined) {
    if (gmailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmailAddress)) {
      throw new ApiError(400, 'Please provide a valid email address.');
    }
    settings.gmailAddress = gmailAddress;
  }
  // Only overwrite the stored (encrypted) password when the Admin actually
  // typed a new one — the UI never round-trips the real password back to us,
  // so an empty/omitted field here must NOT wipe out a previously saved one.
  if (appPassword) {
    settings.setAppPassword(appPassword);
  }
  if (senderName !== undefined) settings.senderName = senderName;
  if (replyTo !== undefined) {
    if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
      throw new ApiError(400, 'Reply-To must be a valid email address.');
    }
    settings.replyTo = replyTo;
  }
  if (enabled !== undefined) {
    if (enabled && !(settings.gmailAddress && (appPassword || settings.hasAppPassword))) {
      throw new ApiError(400, 'Set a Gmail address and App Password before enabling the email service.');
    }
    settings.enabled = Boolean(enabled);
  }

  // Config changed - previous verification result is no longer trustworthy.
  settings.lastVerifyStatus = 'unverified';
  settings.lastVerifyError = '';
  settings.lastVerifiedAt = null;

  await settings.save();

  await logAudit(req, { action: 'update', module: 'settings', targetId: settings._id, description: 'Updated email (SMTP) configuration' });

  res.json({ success: true, data: settings });
});

// @desc  Verify the currently stored Gmail credentials actually connect (no email sent)
// @route POST /api/email-settings/test-connection
const testConnection = asyncHandler(async (req, res) => {
  const result = await verifyConnection();
  res.json({ success: result.success, message: result.message });
});

// @desc  Send a real test email to a given address using the current config
// @route POST /api/email-settings/send-test
// body: { to }
const sendTestEmail = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) throw new ApiError(400, 'A recipient email address is required.');

  const settings = await EmailSettings.getSingleton();
  if (!settings.enabled) throw new ApiError(400, 'Enable the email service before sending a test email.');

  const result = await sendRawEmail({
    to,
    subject: 'Gym ERP - Test Email',
    html: `<p>This is a test email from your Gym ERP email configuration.</p><p>If you received this, your Gmail SMTP setup is working correctly.</p>`,
    templateType: '',
    sentBy: req.user._id,
  });

  await logAudit(req, {
    action: 'create',
    module: 'settings',
    description: `Sent test email to ${to} (${result.success ? 'succeeded' : 'failed'})`,
  });

  if (!result.success) throw new ApiError(502, result.message || 'Failed to send test email.');
  res.json({ success: true, message: `Test email sent to ${to}.` });
});

module.exports = { getEmailSettings, updateEmailSettings, testConnection, sendTestEmail };
