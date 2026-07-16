const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },

    lineItems: [
      {
        description: String,
        quantity: { type: Number, default: 1 },
        unitPrice: Number,
        amount: Number,
      },
    ],

    subTotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    pdfUrl: { type: String, default: '' }, // Cloudinary/S3 URL if stored
    issuedDate: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
