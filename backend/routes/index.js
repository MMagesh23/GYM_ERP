const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/settings', require('./settingsRoutes'));
router.use('/members', require('./memberRoutes'));
router.use('/membership-plans', require('./membershipPlanRoutes'));
router.use('/memberships', require('./membershipRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/expenses', require('./expenseRoutes'));
router.use('/equipment', require('./equipmentRoutes'));
router.use('/maintenance', require('./maintenanceRoutes'));
router.use('/staff', require('./staffRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/audit-logs', require('./auditLogRoutes'));
router.use('/roles', require('./roleRoutes'));

module.exports = router;