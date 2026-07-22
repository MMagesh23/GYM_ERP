const mongoose = require('mongoose');

// One document per calendar day. Amounts are snapshotted at close time so a
// later payment/expense edit can never silently rewrite a past day's numbers —
// see cashClosingController.closeDrawer for how the snapshot is taken.
const cashClosingSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true, index: true }, // normalized to 00:00 local day

    openingCash: { type: Number, required: true, default: 0 }, // = previous day's actualClosingCash (or 0 on day 1)

    cashCollections: { type: Number, required: true, default: 0 }, // sum of cash-method payments collected today
    cashExpenses: { type: Number, required: true, default: 0 },    // sum of cash-method expenses today

    expectedClosingCash: { type: Number, required: true, default: 0 }, // openingCash + cashCollections - cashExpenses
    actualClosingCash: { type: Number },   // entered by staff at close time
    variance: { type: Number },            // actualClosingCash - expectedClosingCash

    status: { type: String, enum: ['draft', 'closed'], default: 'draft', index: true },
    notes: { type: String, default: '' },
    varianceReason: { type: String, default: '' }, // required if variance !== 0 at close time

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

cashClosingSchema.statics.normalizeDate = (d = new Date()) => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
};

module.exports = mongoose.model('CashClosing', cashClosingSchema);