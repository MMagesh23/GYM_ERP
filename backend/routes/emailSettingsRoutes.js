const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getEmailSettings,
  updateEmailSettings,
  testConnection,
  sendTestEmail,
} = require('../controllers/emailSettingsController');

const router = express.Router();

// SMTP credentials are sensitive - admin-only, same as role management (roleRoutes.js).
router.use(protect, authorize('admin'));

router.get('/', getEmailSettings);
router.put('/', updateEmailSettings);
router.post('/test-connection', testConnection);
router.post('/send-test', sendTestEmail);

module.exports = router;
