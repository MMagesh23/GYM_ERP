const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadPhoto } = require('../middleware/upload');
const { listStaff, getStaff, createStaff, updateStaff, toggleDisable, resetPassword } = require('../controllers/staffController');

const router = express.Router();

const staffValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('mobile').notEmpty().withMessage('Mobile number is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email must be valid'),
];

// Staff management is admin-only across the board
router.use(protect, authorize('admin'));

router.get('/', listStaff);
router.get('/:id', getStaff);
router.post('/', uploadPhoto.single('photo'), staffValidation, validate, createStaff);
router.put('/:id', uploadPhoto.single('photo'), updateStaff);
router.patch('/:id/disable', toggleDisable);
router.post('/:id/reset-password', resetPassword);

module.exports = router;
