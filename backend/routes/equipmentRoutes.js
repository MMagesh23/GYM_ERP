const express = require('express');
const { body } = require('express-validator');
const { can } = require('../middleware/rbac');
const { requireFeature } = require('../middleware/featureGate');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
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


router.use(requireFeature('equipmentModule'));

const equipmentValidation = [
  body('name').notEmpty().withMessage('Equipment name is required'),
  body('category').notEmpty().withMessage('Category is required'),
];

router.get('/export', protect, can('equipment', 'export'), exportEquipment);
router.get('/warranty-alerts', protect, can('equipment', 'view'), warrantyAlerts);

router.get('/', protect, can('equipment', 'view'), listEquipment);
router.get('/:id', protect, can('equipment', 'view'), getEquipment);
router.post('/', protect, can('equipment', 'create'), uploadPhoto.single('photo'), equipmentValidation, validate, createEquipment);
router.put('/:id', protect, can('equipment', 'update'), uploadPhoto.single('photo'), updateEquipment);
// FIX (security): status changes previously had no can() check — any authenticated
// user could flip equipment status regardless of assigned Role permissions.
router.patch('/:id/status', protect, can('equipment', 'update'), changeStatus);
router.delete('/:id', protect, can('equipment', 'delete'), deleteEquipment);

router.get('/:id/maintenance', protect, can('equipment', 'view'), listForEquipment);
router.post('/:id/maintenance', protect, can('equipment', 'update'), createMaintenance);

module.exports = router;