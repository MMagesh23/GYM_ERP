const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize, can } = require('../middleware/rbac');
const { updateMaintenance, deleteMaintenance, dueSoon } = require('../controllers/maintenanceController');

const router = express.Router();

// FIX (P1 — RBAC gap): previously only `protect` (any authenticated user),
// no module permission check, inconsistent with every other equipment/
// maintenance endpoint in the app.
router.get('/due', protect, can('equipment', 'view'), dueSoon);
router.put('/:id', protect, authorize('admin'), updateMaintenance);
router.delete('/:id', protect, authorize('admin'), deleteMaintenance);

module.exports = router;