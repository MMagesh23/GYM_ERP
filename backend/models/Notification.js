const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'membership_expiry',
        'payment_due',
        'birthday',
        'equipment_service_due',
        'low_revenue_alert',
        'daily_collection_summary',
      ],
      required: true,
      index: true,
    },
    recipientMember: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    title: { type: String, required: true },
    message: { type: String, required: true },

    channels: {
      system: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },

    status: { type: String, enum: ['pending', 'sent', 'failed', 'read'], default: 'pending' },
    sentAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
