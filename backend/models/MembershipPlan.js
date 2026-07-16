const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    durationType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'annual', 'lifetime', 'custom'],
      required: true,
    },
    durationDays: { type: Number, required: true }, // computed or custom, e.g. 30, 90, 365; large number for lifetime
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // flat or percentage, see discountType
    discountType: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
    tax: { type: Number, default: 0 }, // percentage
    joiningFee: { type: Number, default: 0 },

    freezeAllowed: { type: Boolean, default: false },
    freezeDays: { type: Number, default: 0 },
    maxRenewals: { type: Number, default: 0 }, // 0 = unlimited
    gracePeriodDays: { type: Number, default: 3 },

    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
