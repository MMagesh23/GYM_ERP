const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');

const {
  createPayment,
  listPayments,
  getPayment,
  downloadInvoice,
  refundPayment,
  exportPayments,
} = require('../controllers/paymentController');

const router = express.Router();

// Static paths before /:id

// Export requires explicit export permission (not just any authenticated user),
// since it bulk-exposes every payment record's amounts, methods, and member names.
router.get('/export', protect, can('payments', 'export'), exportPayments);

router.get('/', protect, can('payments', 'view'), listPayments);
router.post(
  '/',
  protect,
  can('payments', 'create'),
  [
    body('memberId').notEmpty().withMessage('Member is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').isIn(['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet']),
    // FIX: previously status was completely unvalidated at the route layer — a
    // direct API call could set status: 'refunded' at creation time, bypassing
    // the refund flow entirely. Creation is now restricted to states a payment can
    // legitimately start in; 'refunded'/'partially_refunded' are terminal states
    // only reachable via POST /:id/refund.
    body('status').optional().isIn(['paid', 'pending', 'partial', 'failed']).withMessage('status must be paid, pending, partial, or failed'),
    body('amountPaid').optional().isFloat({ min: 0 }).withMessage('amountPaid must be a non-negative number'),
  ],
  validate,
  createPayment
);
router.get('/:id', protect, can('payments', 'view'), getPayment);
router.get('/:id/invoice', protect, can('payments', 'view'), downloadInvoice);
router.post(
  '/:id/refund',
  protect,
  can('payments', 'update'),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Refund amount must be greater than 0'),
  ],
  validate,
  refundPayment
);

module.exports = router;