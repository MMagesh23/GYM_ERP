const mongoose = require('mongoose');

const TEMPLATE_TYPES = [
  'membership_expiry_reminder',
  'membership_renewal_reminder',
  'payment_due_reminder',
  'payment_received_confirmation',
  'welcome_message',
  'general_announcement',
];

// NEW — supported message languages. Kept as a short, explicit list (not a
// free-text field) so the frontend can always render a fixed set of tabs/
// options rather than discovering languages dynamically.
const SUPPORTED_LANGUAGES = ['en', 'ta'];
const LANGUAGE_LABELS = { en: 'English', ta: 'தமிழ் (Tamil)' };

const SUPPORTED_PLACEHOLDERS = [
  'memberName',
  'membershipPlan',
  'startDate',
  'expiryDate',
  'daysRemaining',
  'amount',
  'dueAmount',
  'gymName',
  'gymPhone',
  'gymAddress',
];

const FINANCIAL_PLACEHOLDERS = ['amount', 'dueAmount'];

const whatsappTemplateSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TEMPLATE_TYPES, required: true },
    // NEW — which language this document's `body` is written in. Defaults
    // to 'en' so every pre-existing template (created before this field
    // existed) is treated as English without needing a migration.
    language: { type: String, enum: SUPPORTED_LANGUAGES, default: 'en', required: true },
    name: { type: String, required: true },
    body: { type: String, required: true }, // plain text, may contain {{placeholder}} tokens
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// FIX: was `unique: true` on `type` alone, which would reject creating a
// Tamil template for a type that already has an English one. The real
// uniqueness constraint is (type, language) — one document per
// type+language combination.
whatsappTemplateSchema.index({ type: 1, language: 1 }, { unique: true });

whatsappTemplateSchema.statics.TEMPLATE_TYPES = TEMPLATE_TYPES;
whatsappTemplateSchema.statics.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
whatsappTemplateSchema.statics.LANGUAGE_LABELS = LANGUAGE_LABELS;
whatsappTemplateSchema.statics.SUPPORTED_PLACEHOLDERS = SUPPORTED_PLACEHOLDERS;
whatsappTemplateSchema.statics.FINANCIAL_PLACEHOLDERS = FINANCIAL_PLACEHOLDERS;

module.exports = mongoose.model('WhatsappTemplate', whatsappTemplateSchema);