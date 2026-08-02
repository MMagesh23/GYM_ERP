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
  forgotPassword,
  resetPassword,
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
// FIX (H1): logout must not require a valid access token. After the 15-min
// access token expires, a user sitting on the app cannot call this endpoint
// with `protect` in place — the cookie is never cleared server-side and the
// session is never revoked. authController.logout handles both cases: if the
// refresh token in the cookie is present and valid it revokes the session; if
// the cookie is absent or invalid it still clears the cookie and returns 200.
router.post('/logout', logout);
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

// Password reset via emailed link (no auth required - that's the point).
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  forgotPassword
);
router.post(
  '/reset-password',
  [
    body('userId').notEmpty().withMessage('userId is required'),
    body('token').notEmpty().withMessage('token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  resetPassword
);

// Session management — order matters: static paths before /:id-style routes
router.get('/sessions', protect, listMySessions);
router.post('/sessions/revoke-others', protect, revokeOtherSessions);
router.get('/sessions/user/:userId', protect, authorize('admin'), listUserSessions);
router.delete('/sessions/:id', protect, revokeSession);

module.exports = router;
