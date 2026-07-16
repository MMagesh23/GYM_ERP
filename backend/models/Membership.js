const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    status: {
      type: String,
      enum: ['active', 'expired', 'frozen', 'cancelled', 'upgraded', 'transferred'],
      default: 'active',
      index: true,
    },

    type: {
      type: String,
      enum: ['new', 'renewal', 'upgrade', 'downgrade', 'transfer'],
      default: 'new',
    },

    previousMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },

    freezeHistory: [
      {
        from: Date,
        to: Date,
        reason: String,
        daysUsed: Number,
      },
    ],

    renewalCount: { type: Number, default: 0 },

    finalAmount: { type: Number, required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Membership', membershipSchema);
