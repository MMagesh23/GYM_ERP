const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

    amount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true }, // what was invoiced / owed

    amountPaid: { type: Number, default: 0 },

    // FIX (double-payment guard): the client generates one UUID per form
    // "session" (when the Record Payment / Collect Due modal opens) and sends
    // it on every submit attempt for that session. A double-click, a network
    // retry after a timed-out-but-actually-successful request, or two staff
    // racing on the same due all send the SAME key — the unique index below
    // makes the second insert fail atomically at the database level, which a
    // read-then-write balance check alone cannot guarantee under concurrency.
    // `sparse: true` so any pre-existing records (created before this field
    // existed) with no key don't collide with each other on `null`.
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },

    // FIX (configurable payment methods): was a fixed mongoose enum, which
    // meant adding a new payment method required a code deploy. Now a plain
    // string, validated at the controller layer against
    // Settings.paymentMethods (see paymentController.js) so it stays
    // consistent app-wide without needing DB migrations for new methods.
    paymentMethod: { type: String, required: true },
    transactionNumber: { type: String, default: '' },
    paymentDate: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ['paid', 'pending', 'partial', 'refunded', 'partially_refunded', 'failed'],
      default: 'paid',
      index: true,
    },

    refund: {
      isRefunded: { type: Boolean, default: false },
      refundedAmount: { type: Number, default: 0 },
      refundDate: { type: Date },
      reason: { type: String, default: '' },
    },

    notes: { type: String, default: '' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);