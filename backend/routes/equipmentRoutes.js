const express = require('express');
const { body } = require('express-validator');
const { can } = require('../middleware/rbac');
const { requireFeature } = require('../middleware/featureGate');
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

router.use(requireFeature('equipmentModule'));   // equipmentRoutes.js
router.use(requireFeature('financeModule'));     // expenseRoutes.js
router.use(requireFeature('reportsModule'));

const equipmentValidation = [
  body('name').notEmpty().withMessage('Equipment name is required'),
  body('category').notEmpty().withMessage('Category is required'),
];

router.get('/export', protect, can('equipment', 'export'), exportEquipment);
router.get('/warranty-alerts', protect, warrantyAlerts);

router.get('/', protect, listEquipment);
router.get('/:id', protect, getEquipment);
router.post('/', protect, can('equipment', 'create'), uploadPhoto.single('photo'), equipmentValidation, validate, createEquipment);
router.put('/:id', protect, can('equipment', 'update'), uploadPhoto.single('photo'), updateEquipment);
router.patch('/:id/status', protect, changeStatus);
router.delete('/:id', protect, can('equipment', 'delete'), deleteEquipment);

router.get('/:id/maintenance', protect, listForEquipment);
router.post('/:id/maintenance', protect, can('equipment', 'update'), createMaintenance);

module.exports = router;
