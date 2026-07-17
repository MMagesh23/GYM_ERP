const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { listAuditLogs } = require('../controllers/auditLogController');

const router = express.Router();
router.get('/', protect, can('auditLogs', 'view'), listAuditLogs);
module.exports = router;