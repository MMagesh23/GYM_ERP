const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { logActivity } = require('../controllers/whatsappTemplateController');

const router = express.Router();

// Same 'whatsapp' view permission as generating a message — logging an
// activity is part of the same generate/copy/open workflow, never a
// separate, more-privileged action.
router.post('/', protect, can('whatsapp', 'view'), logActivity);

module.exports = router;