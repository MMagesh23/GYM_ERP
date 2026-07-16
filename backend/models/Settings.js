const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Gym Information
    gymName: { type: String, default: 'My Gym' },
    gymLogo: { type: String, default: '' },
    address: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    currencySymbol: { type: String, default: '₹' },
    timeZone: { type: String, default: 'Asia/Kolkata' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    receiptFooterMessage: { type: String, default: 'Thank you for choosing us!' },

    // System Configuration
    memberIdPrefix: { type: String, default: 'GYM' },
    financialYearStartMonth: { type: Number, default: 4 }, // April
    taxPercentage: { type: Number, default: 0 },

    features: {
      qrCode: { type: Boolean, default: true },
      barcode: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      attendance: { type: Boolean, default: true },
      equipmentModule: { type: Boolean, default: true },
      financeModule: { type: Boolean, default: true },
      reportsModule: { type: Boolean, default: true },
    },

    // Auto-incrementing counter for Member IDs, e.g. GYM001
    lastMemberSequence: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Enforce a single settings document (singleton pattern)
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
