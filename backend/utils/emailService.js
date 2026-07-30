const nodemailer = require('nodemailer');
const EmailSettings = require('../models/EmailSettings');
const EmailTemplate = require('../models/EmailTemplate');
const EmailLog = require('../models/EmailLog');
const Settings = require('../models/Settings');
const { DEFAULT_TEMPLATES } = require('./emailTemplatesDefault');

// ── Transporter ──────────────────────────────────────────────────────────
// Built fresh from the current DB-stored config on every send rather than
// cached at boot, since the Admin can change/enable credentials at runtime
// from the Email Settings page and we want that to take effect immediately.
const buildTransporter = (emailSettings) => {
  const user = emailSettings.gmailAddress;
  const pass = emailSettings.getAppPassword();
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

// @desc  Verify the current stored Gmail credentials work, without sending an email.
// Used by both the "Connection Status" indicator and before a manual test send.
const verifyConnection = async () => {
  const emailSettings = await EmailSettings.getSingleton();
  const transporter = buildTransporter(emailSettings);

  if (!transporter) {
    emailSettings.lastVerifyStatus = 'failed';
    emailSettings.lastVerifyError = 'Gmail address and App Password must both be set.';
    emailSettings.lastVerifiedAt = new Date();
    await emailSettings.save();
    return { success: false, message: emailSettings.lastVerifyError };
  }

  try {
    await transporter.verify();
    emailSettings.lastVerifyStatus = 'success';
    emailSettings.lastVerifyError = '';
    emailSettings.lastVerifiedAt = new Date();
    await emailSettings.save();
    return { success: true, message: 'Connected successfully.' };
  } catch (err) {
    emailSettings.lastVerifyStatus = 'failed';
    emailSettings.lastVerifyError = err.message || 'Connection failed.';
    emailSettings.lastVerifiedAt = new Date();
    await emailSettings.save();
    return { success: false, message: emailSettings.lastVerifyError };
  }
};

// ── Templates ────────────────────────────────────────────────────────────
// Lazily seeds a template with its default content the first time it's
// requested, so the feature works immediately without a separate migration
// step, while remaining editable afterwards (see emailTemplateController.js).
const getOrSeedTemplate = async (type) => {
  let template = await EmailTemplate.findOne({ type });
  if (!template) {
    const defaults = DEFAULT_TEMPLATES[type];
    if (!defaults) throw new Error(`No default content defined for email template type "${type}".`);
    template = await EmailTemplate.create({ type, ...defaults });
  }
  return template;
};

// Replaces every {{placeholder}} occurrence with the matching value from
// `data`. Placeholders with no matching key are left as-is (visible in the
// rendered email) rather than silently blanked, so a misconfigured template
// is obvious instead of producing a confusing empty gap.
const renderTemplate = (text, data = {}) =>
  String(text || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== null
      ? String(data[key])
      : match;
  });

// Builds the standard placeholder set from common inputs. Individual callers
// can pass extra keys (e.g. resetLink for password_reset) alongside this.
const buildPlaceholderData = async ({ memberName, membershipPlan, expiryDate, amount, ...extra } = {}) => {
  const settings = await Settings.getSingleton();
  return {
    memberName: memberName || '',
    membershipPlan: membershipPlan || '',
    expiryDate: expiryDate ? new Date(expiryDate).toLocaleDateString() : '',
    amount: amount !== undefined && amount !== null ? `${settings.currencySymbol}${Number(amount).toFixed(2)}` : '',
    gymName: settings.gymName || 'Your Gym',
    ...extra,
  };
};

// ── Sending ──────────────────────────────────────────────────────────────
// Low-level send + log. Never throws — callers (especially automatic
// triggers fired from request handlers) must not have an email failure break
// the primary action (e.g. member creation succeeding but the response
// failing because the welcome email bounced). Returns a result object instead.
const sendRawEmail = async ({ to, subject, html, templateType = '', relatedMember, relatedMembership, relatedPayment, sentBy }) => {
  const emailSettings = await EmailSettings.getSingleton();

  if (!emailSettings.enabled) {
    await EmailLog.create({
      recipient: to,
      subject,
      templateType,
      status: 'failed',
      errorMessage: 'Email service is disabled in Settings.',
      relatedMember,
      relatedMembership,
      relatedPayment,
      sentBy,
    });
    return { success: false, message: 'Email service is disabled.' };
  }

  const transporter = buildTransporter(emailSettings);
  if (!transporter) {
    await EmailLog.create({
      recipient: to,
      subject,
      templateType,
      status: 'failed',
      errorMessage: 'Gmail address and App Password are not configured.',
      relatedMember,
      relatedMembership,
      relatedPayment,
      sentBy,
    });
    return { success: false, message: 'Email is not configured.' };
  }

  const fromAddress = `"${emailSettings.senderName || 'Gym ERP'}" <${emailSettings.gmailAddress}>`;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      ...(emailSettings.replyTo ? { replyTo: emailSettings.replyTo } : {}),
    });

    await EmailLog.create({
      recipient: to,
      subject,
      templateType,
      status: 'sent',
      relatedMember,
      relatedMembership,
      relatedPayment,
      sentBy,
    });
    return { success: true };
  } catch (err) {
    await EmailLog.create({
      recipient: to,
      subject,
      templateType,
      status: 'failed',
      errorMessage: err.message || 'Failed to send email.',
      relatedMember,
      relatedMembership,
      relatedPayment,
      sentBy,
    });
    return { success: false, message: err.message };
  }
};

// High-level helper: renders the named template with placeholder data and
// sends it. This is what the rest of the app (member/membership/payment
// controllers, notification generator, auth controller) should call.
//
// Fire-and-forget by design (see sendEmailAsync below) — a template lookup
// failure or send failure is logged to EmailLog, never thrown back into the
// caller's request flow.
const sendTemplatedEmail = async ({ to, templateType, data, relatedMember, relatedMembership, relatedPayment, sentBy }) => {
  if (!to) return { success: false, message: 'No recipient email address on file.' };

  const template = await getOrSeedTemplate(templateType);
  if (!template.isActive) {
    return { success: false, message: `Template "${templateType}" is disabled.` };
  }

  const placeholderData = await buildPlaceholderData(data);
  const subject = renderTemplate(template.subject, placeholderData);
  const html = renderTemplate(template.body, placeholderData);

  return sendRawEmail({ to, subject, html, templateType, relatedMember, relatedMembership, relatedPayment, sentBy });
};

// Non-blocking wrapper for use inside request handlers: fires the send in the
// background so a slow/failed SMTP call never delays the API response for
// the primary action (member created, payment recorded, etc). Errors are
// swallowed here too — sendTemplatedEmail already logs to EmailLog itself.
const sendTemplatedEmailAsync = (args) => {
  setImmediate(() => {
    sendTemplatedEmail(args).catch((err) => {
      console.error(`Failed to send "${args.templateType}" email to ${args.to}:`, err.message);
    });
  });
};

module.exports = {
  buildTransporter,
  verifyConnection,
  getOrSeedTemplate,
  renderTemplate,
  buildPlaceholderData,
  sendRawEmail,
  sendTemplatedEmail,
  sendTemplatedEmailAsync,
};
