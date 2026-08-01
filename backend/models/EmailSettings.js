const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

// Singleton (same pattern as Settings.js) holding Gmail SMTP configuration.
// The App Password is stored encrypted at rest (see utils/encryption.js) and
// is never returned to the client in plaintext — getSingleton()/toJSON strips
// it, and a dedicated masked flag tells the UI whether one is already set.
const emailSettingsSchema = new mongoose.Schema(
  {
    gmailAddress: { type: String, default: '', trim: true, lowercase: true },
    // Encrypted ciphertext ("iv:authTag:data"), never the raw App Password.
    appPasswordEncrypted: { type: String, default: '' },
    senderName: { type: String, default: 'Gym ERP' },
    replyTo: { type: String, default: '', trim: true, lowercase: true },
    enabled: { type: Boolean, default: false },

    // Last-known connection check result, shown as "Connection Status" in the UI.
    lastVerifiedAt: { type: Date, default: null },
    lastVerifyStatus: { type: String, enum: ['unverified', 'success', 'failed'], default: 'unverified' },
    lastVerifyError: { type: String, default: '' },
  },
  { timestamps: true }
);

emailSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

// Virtual, computed convenience so controllers/services don't each re-implement
// "is a password actually configured" (encrypt('') stores '').
emailSettingsSchema.virtual('hasAppPassword').get(function () {
  return Boolean(this.appPasswordEncrypted);
});

// NEW — distinguishes "ciphertext exists but can no longer be decrypted"
// (ENCRYPTION_KEY changed since it was saved — the classic "works locally,
// broken after deploy" cause) from "never configured". hasAppPassword alone
// can't tell these apart, which made this failure mode invisible in the UI —
// it looked identical to "nothing was ever set up."
emailSettingsSchema.virtual('appPasswordUndecryptable').get(function () {
  return Boolean(this.appPasswordEncrypted) && !this.getAppPassword();
});

emailSettingsSchema.methods.setAppPassword = function (plainPassword) {
  this.appPasswordEncrypted = plainPassword ? encrypt(plainPassword) : '';
};

emailSettingsSchema.methods.getAppPassword = function () {
  return decrypt(this.appPasswordEncrypted);
};

emailSettingsSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    // Never leak the ciphertext or a decrypted password to the client.
    delete ret.appPasswordEncrypted;
    return ret;
  },
});

module.exports = mongoose.model('EmailSettings', emailSettingsSchema);