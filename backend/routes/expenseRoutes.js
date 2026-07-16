const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadDocument } = require('../middleware/upload');
const {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  analytics,
  exportExpenses,
} = require('../controllers/expenseController');

const router = express.Router();

const CATEGORIES = ['rent', 'electricity', 'salary', 'equipment', 'internet', 'maintenance', 'marketing', 'cleaning', 'miscellaneous'];

const expenseValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('category').isIn(CATEGORIES).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
];

// Static paths before /:id
router.get('/export', protect, authorize('admin'), exportExpenses);
router.get('/analytics', protect, authorize('admin'), analytics);

router.get('/', protect, authorize('admin'), listExpenses);
router.get('/:id', protect, authorize('admin'), getExpense);
router.post('/', protect, authorize('admin'), uploadDocument.single('bill'), expenseValidation, validate, createExpense);
router.put('/:id', protect, authorize('admin'), uploadDocument.single('bill'), updateExpense);
router.delete('/:id', protect, authorize('admin'), deleteExpense);

module.exports = router;
