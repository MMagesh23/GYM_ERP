const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { updateMaintenance, deleteMaintenance, dueSoon } = require('../controllers/maintenanceController');

const router = express.Router();

router.get('/due', protect, dueSoon);
router.put('/:id', protect, authorize('admin'), updateMaintenance);
router.delete('/:id', protect, authorize('admin'), deleteMaintenance);

module.exports = router;
