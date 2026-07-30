const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    photo: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'receptionist'],
      required: true,
      default: 'receptionist',
    },
    // Optional link to a granular Role document (module-level permission overrides)
    roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },

    // Linked staff profile (for receptionists) - see Staff module (Phase 4)
    staffProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },

    isActive: { type: Boolean, default: true },

    // Security / account lock
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // Refresh token rotation
    refreshTokenHash: { type: String, default: null },

    // Password reset (email-based, via the "Password Reset" email template).
    // Stores a SHA-256 hash of the reset token, never the raw token — same
    // rationale as refreshTokenHash: a leaked DB dump alone can't be replayed.
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    lastLoginAt: { type: Date },
    lastLoginIP: { type: String },
  },
  { timestamps: true }
);

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.setPassword = async function (plainPassword) {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  this.passwordHash = await bcrypt.hash(plainPassword, saltRounds);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.resetPasswordTokenHash;
    delete ret.resetPasswordExpires;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
