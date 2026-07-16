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
    finalAmount: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'],
      required: true,
    },
    transactionNumber: { type: String, default: '' },
    paymentDate: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ['paid', 'pending', 'partial', 'refunded', 'failed'],
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
