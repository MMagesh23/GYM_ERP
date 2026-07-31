const mongoose = require('mongoose');

// Mirrors EmailTemplate.js's shape/rationale, but WhatsApp messages are
// plain text only — no subject, no HTML. Kept as a fully separate model
// (not a shared collection with EmailTemplate) so the two systems can
// never accidentally cross-contaminate content or triggers, and so this
// feature can never affect the existing email template system.
const TEMPLATE_TYPES = [
  'membership_expiry_reminder',
  'membership_renewal_reminder',
  'payment_due_reminder',
  'payment_received_confirmation',
  'welcome_message',
  'general_announcement',
];

// Placeholders supported in WhatsApp templates. `amount` and `dueAmount`
// are financial and gated server-side per the caller's finance permission —
// see utils/whatsappService.js#buildWhatsappPlaceholderData. Deliberately a
// separate list from EmailTemplate.SUPPORTED_PLACEHOLDERS (adds startDate,
// daysRemaining, dueAmount, gymPhone, gymAddress) even though the two
// overlap — the rendering utility (renderTemplate) is shared, this list
// is not.
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
    type: { type: String, enum: TEMPLATE_TYPES, required: true, unique: true },
    name: { type: String, required: true },
    body: { type: String, required: true }, // plain text, may contain {{placeholder}} tokens
    isActive: { type: Boolean, default: true }, // if false, hidden from the "generate message" template picker
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

whatsappTemplateSchema.statics.TEMPLATE_TYPES = TEMPLATE_TYPES;
whatsappTemplateSchema.statics.SUPPORTED_PLACEHOLDERS = SUPPORTED_PLACEHOLDERS;
whatsappTemplateSchema.statics.FINANCIAL_PLACEHOLDERS = FINANCIAL_PLACEHOLDERS;

module.exports = mongoose.model('WhatsappTemplate', whatsappTemplateSchema);