const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const {
  createMembership,
  renewMembership,
  changePlan,
  transferMembership,
  freezeMembership,
  unfreezeMembership,
  cancelMembership,
  expiringSoon,
  historyForMember,
  outstandingMemberships,
} = require('../controllers/membershipController');

const router = express.Router();

router.get('/expiring', protect, can('memberships', 'view'), expiringSoon);
router.get('/outstanding', protect, can('payments', 'view'), outstandingMemberships);
router.get('/member/:memberId', protect, can('memberships', 'view'), historyForMember);

router.post(
  '/',
  protect,
  can('memberships', 'create'),
  [
    body('memberId').notEmpty(),
    body('planId').notEmpty(),
    // FIX: extraDiscount had no validation — a negative value would silently
    // increase the price above the plan's own price via calcFinalAmount.
    body('extraDiscount').optional().isFloat({ min: 0 }).withMessage('extraDiscount must be a non-negative number'),
  ],
  validate,
  createMembership
);
router.post('/:id/renew', protect, can('memberships', 'create'), renewMembership);
router.post(
  '/:id/change-plan',
  protect,
  can('memberships', 'update'),
  [
    body('newPlanId').notEmpty().withMessage('newPlanId is required'),
    body('direction').isIn(['upgrade', 'downgrade']).withMessage("direction must be 'upgrade' or 'downgrade'"),
  ],
  validate,
  changePlan
);
router.post(
  '/:id/transfer',
  protect,
  can('memberships', 'update'),
  [body('toMemberId').notEmpty().withMessage('toMemberId is required')],
  validate,
  transferMembership
);
router.post(
  '/:id/freeze',
  protect,
  can('memberships', 'update'),
  [body('days').isInt({ min: 1 }).withMessage('days must be a positive integer')],
  validate,
  freezeMembership
);
router.post('/:id/unfreeze', protect, can('memberships', 'update'), unfreezeMembership);
router.post('/:id/cancel', protect, can('memberships', 'update'), cancelMembership);

module.exports = router;