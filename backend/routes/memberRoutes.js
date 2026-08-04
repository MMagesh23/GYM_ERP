const express = require('express');
const { body } = require('express-validator');
const { can } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadSpreadsheet, uploadMemberPhoto, verifyMemberPhotoBuffer } = require('../middleware/upload');
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


router.get('/export', protect, can('members', 'export'), exportMembers);
router.post('/import', protect, can('members', 'create'), uploadSpreadsheet.single('file'), importMembers);

router.get('/', protect, can('members', 'view'), listMembers);
router.get('/:id', protect, can('members', 'view'), getMember);
router.post(
  '/',
  protect,
  can('members', 'create'),
  uploadMemberPhoto.single('photo'),
  verifyMemberPhotoBuffer,
  memberValidation,
  validate,
  createMember
);
router.put(
  '/:id',
  protect,
  can('members', 'update'),
  uploadMemberPhoto.single('photo'),
  verifyMemberPhotoBuffer,
  memberValidation,
  validate,
  updateMember
);

router.patch('/:id/status', protect, can('members', 'update'), changeStatus);
router.delete('/:id', protect, can('members', 'delete'), deleteMember);

module.exports = router;