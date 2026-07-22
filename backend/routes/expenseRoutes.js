const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { requireFeature } = require('../middleware/featureGate');
const { uploadDocument, verifyDocumentBuffer } = require('../middleware/upload');
const { listExpenses, getExpense, createExpense, updateExpense, deleteExpense, analytics, exportExpenses } = require('../controllers/expenseController');

const router = express.Router();
router.use(requireFeature('financeModule'));

const CATEGORIES = ['rent', 'electricity', 'salary', 'equipment', 'internet', 'maintenance', 'marketing', 'cleaning', 'miscellaneous'];
const expenseValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('category').isIn(CATEGORIES).withMessage('Invalid category'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
];

router.get('/export', protect, can('expenses', 'export'), exportExpenses);
router.get('/analytics', protect, can('expenses', 'view'), analytics);

router.get('/', protect, can('expenses', 'view'), listExpenses);
router.get('/:id', protect, can('expenses', 'view'), getExpense);
router.post('/', protect, can('expenses', 'create'), uploadDocument.single('bill'), verifyDocumentBuffer, expenseValidation, validate, createExpense);
router.put('/:id', protect, can('expenses', 'update'), uploadDocument.single('bill'), verifyDocumentBuffer, updateExpense);
router.delete('/:id', protect, can('expenses', 'delete'), deleteExpense);

// expenseRoutes.js

module.exports = router;