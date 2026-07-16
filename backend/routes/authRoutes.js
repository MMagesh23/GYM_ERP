const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  register,
  login,
  refresh,
  logout,
  me,
  listMySessions,
  revokeSession,
  revokeOtherSessions,
  listUserSessions,
  changePassword,
} = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  protect,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['admin', 'receptionist']),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, me);

router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  changePassword
);

// Session management — order matters: static paths before /:id-style routes
router.get('/sessions', protect, listMySessions);
router.post('/sessions/revoke-others', protect, revokeOtherSessions);
router.get('/sessions/user/:userId', protect, authorize('admin'), listUserSessions);
router.delete('/sessions/:id', protect, revokeSession);

module.exports = router;