const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Identity / Branding
    gymName: { type: String, default: 'My Gym' },
    tagline: { type: String, default: '' },
    gymLogo: { type: String, default: '' },        // returned as /uploads/branding/xxx.png
    favicon: { type: String, default: '' },
    brandColor: { type: String, default: '#3390fa' }, // drives --brand-500 at runtime
    accentColor: { type: String, default: '#10b981' },

    address: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },

    paymentMethods: {
      type: [String],
      default: ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'],
    },

    currencySymbol: { type: String, default: '₹' },
    currencyCode: { type: String, default: 'INR' },
    timeZone: { type: String, default: 'Asia/Kolkata' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    weekStartsOn: { type: Number, default: 1 }, // 0=Sun

    businessHours: [
      {
        day: { type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
        open: String,   // "06:00"
        close: String,  // "22:00"
        closed: { type: Boolean, default: false },
      },
    ],

    // Invoice / receipt customization
    invoicePrefix: { type: String, default: 'INV' },
    invoiceNumberPadding: { type: Number, default: 5 },
    invoiceTerms: { type: String, default: '' },
    receiptFooterMessage: { type: String, default: 'Thank you for choosing us!' },
    invoiceAccentColor: { type: String, default: '#3390fa' },

    // System / ERP configuration
    memberIdPrefix: { type: String, default: 'GYM' },
    financialYearStartMonth: { type: Number, default: 4 },
    taxPercentage: { type: Number, default: 0 },
    defaultGracePeriodDays: { type: Number, default: 3 },
    lowStockThresholdDays: { type: Number, default: 7 }, // equipment warranty/service alert window
    sessionIdleTimeoutMinutes: { type: Number, default: 0 }, // 0 = disabled

    // Feature toggles
    features: {
      qrCode: { type: Boolean, default: true },
      barcode: { type: Boolean, default: false },
      email: { type: Boolean, default: false },   // now honestly reflects: not implemented
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      attendance: { type: Boolean, default: false }, // no attendance module exists yet — see note below
      equipmentModule: { type: Boolean, default: true },
      financeModule: { type: Boolean, default: true },
      reportsModule: { type: Boolean, default: true },
      multiCurrency: { type: Boolean, default: false },
      // requireMfaForAdmin removed — no MFA implementation exists; a toggle with
      // no effect is worse than no toggle, since an admin could believe it's enforced.
    },
    // add inside settingsSchema, alongside `features`
    dashboardWidgets: {
      admin: {
        type: [String],
        default: [
          'totalMembers', 'activeMembers', 'expiredMembers', 'newMembersThisMonth',
          'monthlyRevenue', 'monthlyExpenses', 'netProfit', 'equipmentCount',
          'membershipsExpiringSoon', 'pendingPayments',
          'revenueChart', 'membershipGrowthChart', 'profitChart', 'planDistributionChart',
        ],
      },
      receptionist: {
        type: [String],
        default: [
          'totalMembers', 'activeMembers', 'newMembersThisMonth',
          'membershipsExpiringSoon', 'pendingPayments',
          'membershipGrowthChart', 'planDistributionChart',
        ],
      },
    },

    // Social / online presence (optional but common ask for "customizable")
    socialLinks: {
      instagram: { type: String, default: '' },
      facebook: { type: String, default: '' },
      youtube: { type: String, default: '' },
    },

    lastMemberSequence: { type: Number, default: 0 },
  },
  { timestamps: true }
);

settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);