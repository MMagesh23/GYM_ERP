// Default seed list — used when Settings.paymentMethods hasn't been
// customized by an admin yet, and as the fallback everywhere a
// configurable-methods check needs *something* to validate against.
const DEFAULT_PAYMENT_METHODS = ['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet'];

module.exports = { DEFAULT_PAYMENT_METHODS };