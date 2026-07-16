const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadPhoto } = require('../middleware/upload');
const {
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  changeStatus,
  warrantyAlerts,
  exportEquipment,
} = require('../controllers/equipmentController');
const { createMaintenance, listForEquipment } = require('../controllers/maintenanceController');

const router = express.Router();

const equipmentValidation = [
  body('name').notEmpty().withMessage('Equipment name is required'),
  body('category').notEmpty().withMessage('Category is required'),
];

// Static paths before /:id
router.get('/export', protect, authorize('admin'), exportEquipment);
router.get('/warranty-alerts', protect, warrantyAlerts);

router.get('/', protect, listEquipment);
router.get('/:id', protect, getEquipment);
router.post('/', protect, authorize('admin'), uploadPhoto.single('photo'), equipmentValidation, validate, createEquipment);
router.put('/:id', protect, authorize('admin'), uploadPhoto.single('photo'), updateEquipment);
router.patch('/:id/status', protect, changeStatus);
router.delete('/:id', protect, authorize('admin'), deleteEquipment);

// Nested maintenance history
router.get('/:id/maintenance', protect, listForEquipment);
router.post('/:id/maintenance', protect, authorize('admin'), createMaintenance);

module.exports = router;
