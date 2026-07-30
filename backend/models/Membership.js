const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },

    startDate: { type: Date, required: true },
    // NEW — indexed: supports the "active memberships expiring within N
    // days" range query used by the dashboard, membershipController.expiringSoon,
    // and the Members page's expiry filter.
    endDate: { type: Date, required: true, index: true },

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
        to: Date, // originally-reserved end of the freeze
        reason: String,
        daysUsed: Number, // requested days at freeze time; reduced on early unfreeze
        // FIX: when the member actually unfroze, if earlier than `to`. Presence of
        // this field (vs. undefined) is how unfreezeMembership() knows a given
        // freeze entry has already been settled, so it doesn't double-adjust.
        actualTo: Date,
      },
    ],

    renewalCount: { type: Number, default: 0 },

    finalAmount: { type: Number, required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// NEW — compound index matching the exact query shape used everywhere
// "expiring soon" is computed: equality on status + range on endDate.
membershipSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('Membership', membershipSchema);