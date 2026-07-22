const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        'rent',
        'electricity',
        'salary',
        'equipment',
        'internet',
        'maintenance',
        'marketing',
        'cleaning',
        'miscellaneous',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    expenseDate: { type: Date, default: Date.now, index: true },
    paymentMethod: { type: String, default: 'cash' }, // validated against Settings.paymentMethods in the controller, not a fixed enum,
    billUrl: { type: String, default: '' }, // uploaded bill/receipt (Cloudinary)
    vendor: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
