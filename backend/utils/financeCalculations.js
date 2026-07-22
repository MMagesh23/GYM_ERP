// SINGLE SOURCE OF TRUTH for revenue/profit math. Every dashboard card, chart,
// and report must import from here — do not re-derive this logic locally.
//
// Accounting model used throughout this app:
//   Gross Revenue (period) = money actually collected on payments whose
//                            paymentDate falls in the period (amountPaid,
//                            falling back to finalAmount for records that
//                            predate the amountPaid field). Included for ANY
//                            status where money was ever collected — paid,
//                            partial, refunded, partially_refunded — never
//                            'pending' or 'failed'.
//   Refunds (period)       = money paid back out, attributed to the period the
//                            REFUND happened (refund.refundDate), not
//                            retroactively restated into the original sale's
//                            month. Standard cash-basis P&L treatment: a refund
//                            is its own outflow event, distinct from the sale
//                            that preceded it.
//   Net Revenue (period)   = Gross Revenue (period) − Refunds (period)
//   Net Profit (period)    = Net Revenue (period) − Expenses (period)
//
// FIX: previously every revenue aggregation filtered payments with
// status: { $in: ['paid', 'partial'] } BEFORE summing. Since refundPayment()
// flips status to 'refunded'/'partially_refunded' the moment any refund is
// issued, that filter silently dropped the ENTIRE original payment amount
// from revenue the moment it was touched by any refund — not just the
// refunded portion. This module fixes that by summing gross collections
// (across all money-was-collected statuses) and subtracting refunds
// separately, attributed to when the refund happened.

const GROSS_REVENUE_STATUSES = ['paid', 'partial', 'refunded', 'partially_refunded'];

// Amount actually collected on a payment, ignoring refunds (tracked separately)
const GROSS_COLLECTED_EXPR = { $ifNull: ['$amountPaid', '$finalAmount'] };

const grossRevenueMatchStage = (dateField, gte, lt) => ({
  $match: { [dateField]: { $gte: gte, $lt: lt }, status: { $in: GROSS_REVENUE_STATUSES } },
});

const refundMatchStage = (gte, lt) => ({
  $match: { 'refund.refundDate': { $gte: gte, $lt: lt }, 'refund.refundedAmount': { $gt: 0 } },
});

// JS-side equivalents for single-document / already-fetched contexts
const grossCollectedOf = (payment) => {
  if (!payment || !GROSS_REVENUE_STATUSES.includes(payment.status)) return 0;
  return payment.amountPaid ?? payment.finalAmount ?? 0;
};

const refundedOf = (payment) => payment?.refund?.refundedAmount || 0;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

module.exports = {
  GROSS_REVENUE_STATUSES,
  GROSS_COLLECTED_EXPR,
  grossRevenueMatchStage,
  refundMatchStage,
  grossCollectedOf,
  refundedOf,
  round2,
};