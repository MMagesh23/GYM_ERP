const express = require('express');
const { body } = require('express-validator');
const { can } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { listPlans, getPlan, createPlan, updatePlan, deletePlan } = require('../controllers/membershipPlanController');

const router = express.Router();

const planValidation = [
  body('name').notEmpty().withMessage('Plan name is required'),
  body('durationType').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'annual', 'lifetime', 'custom']),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
];

router.get('/', protect, listPlans);
router.get('/:id', protect, getPlan);
router.post('/', protect, can('memberships', 'create'), planValidation, validate, createPlan);
router.put('/:id', protect, can('memberships', 'update'), updatePlan);
// FIX: this used to always soft-deactivate. Now runs a real, guarded delete —
// see membershipPlanController.deletePlan for the safety rules (blocked while
// in active/frozen use, deactivated instead of deleted if it has history,
// hard-deleted only if genuinely unused). Same RBAC permission as before.
router.delete('/:id', protect, can('memberships', 'delete'), deletePlan);

module.exports = router;