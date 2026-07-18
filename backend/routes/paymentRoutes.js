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

// FIX (security): export previously had only `protect`, letting any authenticated
// user bulk-download every payment record (amounts, methods, member names). Now
// requires explicit export permission, consistent with expenseRoutes.js.
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
  ],
  validate,
  createPayment
);
router.get('/:id', protect, can('payments', 'view'), getPayment);
router.get('/:id/invoice', protect, can('payments', 'view'), downloadInvoice);
router.post('/:id/refund', protect, can('payments', 'update'), refundPayment);

module.exports = router;