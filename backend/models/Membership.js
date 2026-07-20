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

module.exports = mongoose.model('Membership', membershipSchema);