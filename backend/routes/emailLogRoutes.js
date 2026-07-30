const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { listEmailLogs, sendAnnouncement } = require('../controllers/emailLogController');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', listEmailLogs);
router.post('/announcement', sendAnnouncement);

module.exports = router;
