const mongoose = require('mongoose');

// One record per send attempt. Kept even for failures so the Admin can see
// exactly what went out (or tried to), following the same "log everything,
// filter in the UI" pattern as AuditLog.js.
const emailLogSchema = new mongoose.Schema(
  {
    recipient: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true },
    templateType: { type: String, default: '' }, // matches EmailTemplate.TEMPLATE_TYPES, or '' for ad-hoc/test emails

    status: { type: String, enum: ['sent', 'failed'], required: true, index: true },
    errorMessage: { type: String, default: '' },

    // Loose links back to the record that triggered this email, for traceability
    // (e.g. "which member did this welcome email go to"). Not populated/required
    // since test emails and announcements have no single related record.
    relatedMember: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    relatedMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
    relatedPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },

    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = system/automatic trigger
  },
  { timestamps: true } // createdAt doubles as "Date & Time"
);

emailLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
