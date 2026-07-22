const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { requireFeature } = require('../middleware/featureGate');
const { financeSummary, revenueByPlan } = require('../controllers/financeController');

const router = express.Router();
router.use(requireFeature('financeModule'));

router.get('/summary', protect, can('finance', 'view'), financeSummary);
router.get('/revenue-by-plan', protect, can('finance', 'view'), revenueByPlan);
router.use('/cash-closing', require('./cashClosingRoutes'));

module.exports = router;