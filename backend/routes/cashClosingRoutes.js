const express = require('express');
const { protect } = require('../middleware/auth');
const { can, authorize } = require('../middleware/rbac');
const { previewClosing, listClosings, closeDrawer, reopenClosing } = require('../controllers/cashClosingController');

const router = express.Router();

router.get('/preview', protect, can('finance', 'view'), previewClosing);
router.get('/', protect, can('finance', 'view'), listClosings);
router.post('/close', protect, can('finance', 'update'), closeDrawer);
// Reopening a locked financial record is admin-only, full stop — no custom
// role can be granted this (unlike close, which can()'s permission matrix
// could technically allow a non-admin role to do).
router.post('/:id/reopen', protect, authorize('admin'), reopenClosing);

module.exports = router;