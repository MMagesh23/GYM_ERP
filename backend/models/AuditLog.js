const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['login', 'logout', 'create', 'update', 'delete', 'payment', 'renewal', 'expense'],
      required: true,
      index: true,
    },
    module: { type: String, default: '' }, // e.g. 'members', 'payments'
    targetId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
