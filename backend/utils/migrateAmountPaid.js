// One-time backfill for the new Payment.amountPaid field. Existing payment
// documents predate this field; all revenue/refund logic falls back to
// finalAmount via $ifNull until this runs, so nothing breaks in the meantime —
// but run this once to get accurate historical reporting.
//
// Assumption used for legacy records: 'paid' -> finalAmount, 'pending'/'failed'
// -> 0, everything else (including old 'partial' records, which had no recorded
// collected amount before this fix) -> finalAmount. Review old 'partial' rows by
// hand afterward if the exact historical collected figure matters for your books.
//
// Usage: npm run migrate:amount-paid   (from backend/)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Payment = require('../models/Payment');

const run = async () => {
  await connectDB();

  const payments = await Payment.find({ amountPaid: { $exists: false } });
  let updated = 0;

  for (const p of payments) {
    p.amountPaid = p.status === 'pending' || p.status === 'failed' ? 0 : p.finalAmount;
    await p.save();
    updated += 1;
  }

  console.log(`Backfilled amountPaid on ${updated} payment(s).`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});