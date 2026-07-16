const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { listNotifications, markRead, markAllRead, generateNow } = require('../controllers/notificationController');

const router = express.Router();

router.get('/', protect, listNotifications);
router.patch('/read-all', protect, markAllRead);
router.patch('/:id/read', protect, markRead);
router.post('/generate', protect, authorize('admin'), generateNow);

module.exports = router;
