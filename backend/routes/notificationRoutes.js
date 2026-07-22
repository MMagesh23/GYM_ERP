const express = require('express');
const { can } = require('../middleware/rbac');
const { protect } = require('../middleware/auth');
const { listNotifications, markRead, markAllRead, generateNow } = require('../controllers/notificationController');

const router = express.Router();

// FIX (P0 — RBAC gap): these routes previously had no can() check at all,
// so any authenticated user could read and mark-all-read the global
// notification feed regardless of their role's permission matrix. 'notifications'
// is already in rbac.js's OPEN_BY_DEFAULT_MODULES/ACTIONS, so a user with no
// custom Role assigned (the common case) sees no behavior change — this only
// closes the gap for a custom Role that deliberately denies the module.
router.get('/', protect, can('notifications', 'view'), listNotifications);
router.patch('/read-all', protect, can('notifications', 'update'), markAllRead);
router.patch('/:id/read', protect, can('notifications', 'update'), markRead);
router.post('/generate', protect, can('notifications', 'create'), generateNow);

module.exports = router;