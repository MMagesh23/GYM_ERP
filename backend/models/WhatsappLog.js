const mongoose = require('mongoose');

// OPTIONAL, best-effort activity log for WhatsApp communication. Per the
// feature's manual-only design, this can NEVER truthfully record a message
// as "sent" — WhatsApp messages always leave this app manually. The only
// actions ever recorded are that a message was generated, copied to the
// clipboard, or that the WhatsApp deep link was opened.
//
// Message CONTENT is deliberately never stored here, to avoid holding a
// second copy of personal communication text with no corresponding
// send-confirmation to justify retaining it.
const whatsappLogSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    templateType: { type: String, required: true },
    action: { type: String, enum: ['generated', 'copied', 'opened'], required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

whatsappLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WhatsappLog', whatsappLogSchema);