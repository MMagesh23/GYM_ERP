const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { requireFeature } = require('../middleware/featureGate');
const {
  memberReport, membershipReport, paymentReport, expenseReport,
  profitReport, profitReportPdf, equipmentReport, staffReport,
  cashFlowReport, revenueByMethodReport, revenueByPlanReport,
} = require('../controllers/reportController');

const router = express.Router();
router.use(requireFeature('reportsModule'));
router.use(protect);

router.get('/members', can('reports', 'export'), memberReport);
router.get('/memberships', can('reports', 'export'), membershipReport);
router.get('/payments', can('reports', 'export'), paymentReport);
router.get('/expenses', can('reports', 'export'), expenseReport);
router.get('/profit', can('reports', 'export'), profitReport);
router.get('/profit/pdf', can('reports', 'export'), profitReportPdf);
router.get('/equipment', can('reports', 'export'), equipmentReport);
router.get('/staff', can('reports', 'export'), staffReport);
// NEW
router.get('/cash-flow', can('reports', 'export'), cashFlowReport);
router.get('/revenue-by-method', can('reports', 'export'), revenueByMethodReport);
router.get('/revenue-by-plan', can('reports', 'export'), revenueByPlanReport);

module.exports = router;