const mongoose = require('mongoose');

// One document per template "type" — types are fixed (the app triggers emails
// by type, e.g. on member creation), but subject/body are fully editable by
// the Admin so wording/branding can change without a code deploy.
const TEMPLATE_TYPES = [
  'welcome',
  'membership_registration',
  'membership_renewal_reminder',
  'membership_expiry_notice',
  'payment_receipt',
  'payment_reminder',
  'password_reset',
  'announcement',
];

// Placeholders supported across templates. Not every placeholder is relevant
// to every template (e.g. {{amount}} has no meaning in a welcome email) —
// the UI just shows the full list as available tokens per requirements, and
// renderTemplate() below leaves any it can't resolve as literal text.
const SUPPORTED_PLACEHOLDERS = ['memberName', 'membershipPlan', 'expiryDate', 'amount', 'gymName'];

const emailTemplateSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TEMPLATE_TYPES, required: true, unique: true },
    name: { type: String, required: true }, // human-readable label shown in the UI
    subject: { type: String, required: true },
    body: { type: String, required: true }, // HTML, may contain {{placeholder}} tokens
    isActive: { type: Boolean, default: true }, // if false, automatic triggers skip sending (manual send from UI still allowed)
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

emailTemplateSchema.statics.TEMPLATE_TYPES = TEMPLATE_TYPES;
emailTemplateSchema.statics.SUPPORTED_PLACEHOLDERS = SUPPORTED_PLACEHOLDERS;

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
