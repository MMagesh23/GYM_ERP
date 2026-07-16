const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
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
router.get('/export', protect, exportPayments);

router.get('/', protect, listPayments);
router.post(
  '/',
  protect,
  [
    body('memberId').notEmpty().withMessage('Member is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').isIn(['cash', 'upi', 'credit_card', 'debit_card', 'bank_transfer', 'wallet']),
  ],
  validate,
  createPayment
);
router.get('/:id', protect, getPayment);
router.get('/:id/invoice', protect, downloadInvoice);
router.post('/:id/refund', protect, authorize('admin'), refundPayment);

module.exports = router;
