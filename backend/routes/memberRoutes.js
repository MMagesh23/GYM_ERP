const express = require('express');
const { body } = require('express-validator');
const { can } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadSpreadsheet } = require('../middleware/upload');
const {
  listMembers,
  getMember,
  createMember,
  updateMember,
  deleteMember,
  changeStatus,
  exportMembers,
  importMembers,
} = require('../controllers/memberController');

const router = express.Router();

const memberValidation = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email must be valid'),
];

// Order matters: static paths before the /:id param route
router.get('/export', protect, exportMembers);
router.post('/import', protect, can('members', 'create'), uploadSpreadsheet.single('file'), importMembers);

router.get('/', protect, listMembers);
router.get('/:id', protect, getMember);
router.post('/', protect, memberValidation, validate, createMember); // admin + receptionist can register members
router.put('/:id', protect, memberValidation, validate, updateMember);
router.patch('/:id/status', protect, changeStatus);
router.delete('/:id', protect, can('members', 'delete'), deleteMember);

module.exports = router;
