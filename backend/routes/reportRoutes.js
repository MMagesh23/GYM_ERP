const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  memberReport,
  membershipReport,
  paymentReport,
  expenseReport,
  profitReport,
  profitReportPdf,
  equipmentReport,
  staffReport,
} = require('../controllers/reportController');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/members', memberReport);
router.get('/memberships', membershipReport);
router.get('/payments', paymentReport);
router.get('/expenses', expenseReport);
router.get('/profit', profitReport);
router.get('/profit/pdf', profitReportPdf);
router.get('/equipment', equipmentReport);
router.get('/staff', staffReport);

module.exports = router;
