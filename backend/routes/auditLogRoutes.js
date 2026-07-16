const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { listAuditLogs } = require('../controllers/auditLogController');

const router = express.Router();

router.get('/', protect, authorize('admin'), listAuditLogs);

module.exports = router;
