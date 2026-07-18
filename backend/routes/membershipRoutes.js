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
} = require('../controllers/membershipController');

const router = express.Router();

router.get('/expiring', protect, can('memberships', 'view'), expiringSoon);
router.get('/member/:memberId', protect, can('memberships', 'view'), historyForMember);

router.post(
  '/',
  protect,
  can('memberships', 'create'),
  [body('memberId').notEmpty(), body('planId').notEmpty()],
  validate,
  createMembership
);
router.post('/:id/renew', protect, can('memberships', 'create'), renewMembership);
router.post('/:id/change-plan', protect, can('memberships', 'update'), changePlan);
router.post('/:id/transfer', protect, can('memberships', 'update'), transferMembership);
router.post('/:id/freeze', protect, can('memberships', 'update'), freezeMembership);
router.post('/:id/unfreeze', protect, can('memberships', 'update'), unfreezeMembership);
router.post('/:id/cancel', protect, can('memberships', 'update'), cancelMembership);

module.exports = router;