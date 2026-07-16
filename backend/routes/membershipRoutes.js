const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
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

router.get('/expiring', protect, expiringSoon);
router.get('/member/:memberId', protect, historyForMember);

router.post(
  '/',
  protect,
  [body('memberId').notEmpty(), body('planId').notEmpty()],
  validate,
  createMembership
);
router.post('/:id/renew', protect, renewMembership);
router.post('/:id/change-plan', protect, changePlan);
router.post('/:id/transfer', protect, transferMembership);
router.post('/:id/freeze', protect, freezeMembership);
router.post('/:id/unfreeze', protect, unfreezeMembership);
router.post('/:id/cancel', protect, cancelMembership);

module.exports = router;
