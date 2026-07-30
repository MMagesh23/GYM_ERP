const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { summary, charts, expiringMemberships } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', protect, can('dashboard', 'view'), summary);
router.get('/charts', protect, can('dashboard', 'view'), charts);
// NEW — gated on 'memberships' (matching the existing membershipsExpiringSoon
// widget/count and membershipController.expiringSoon), not 'dashboard', since
// this returns membership/member data.
router.get('/expiring-memberships', protect, can('memberships', 'view'), expiringMemberships);

module.exports = router;