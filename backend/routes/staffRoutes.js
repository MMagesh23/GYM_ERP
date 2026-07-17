const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { uploadPhoto } = require('../middleware/upload');
const { listStaff, getStaff, createStaff, updateStaff, toggleDisable, resetPassword } = require('../controllers/staffController');

const router = express.Router();

const staffValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('mobile').notEmpty().withMessage('Mobile number is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email must be valid'),
];

router.use(protect);

router.get('/', can('staff', 'view'), listStaff);
router.get('/:id', can('staff', 'view'), getStaff);
router.post('/', can('staff', 'create'), uploadPhoto.single('photo'), staffValidation, validate, createStaff);
router.put('/:id', can('staff', 'update'), uploadPhoto.single('photo'), updateStaff);
router.patch('/:id/disable', can('staff', 'update'), toggleDisable);
router.post('/:id/reset-password', can('staff', 'update'), resetPassword);

module.exports = router;