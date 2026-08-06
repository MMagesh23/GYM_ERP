const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    deviceLabel: { type: String, default: '' }, // parsed from userAgent, e.g. "Chrome on Windows"
    lastActiveAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
    revokedReason: { type: String, default: '' }, // 'logout' | 'manual_revoke' | 'reuse_detected'
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, revoked: 1 });

module.exports = mongoose.model('Session', sessionSchema);