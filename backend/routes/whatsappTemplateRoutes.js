const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const {
  listTemplates,
  getTemplate,
  updateTemplate,
  resetTemplate,
  previewTemplate,
  generateMessage,
} = require('../controllers/whatsappTemplateController');

const router = express.Router();

router.use(protect);

// Viewing/generating/previewing requires 'whatsapp' VIEW permission —
// granted to admins automatically (can() bypass) and to Receptionist by
// default (see utils/seed.js), or to any custom role explicitly given
// whatsapp.view.
router.get('/', can('whatsapp', 'view'), listTemplates);
router.get('/:type', can('whatsapp', 'view'), getTemplate);
router.post('/:type/preview', can('whatsapp', 'view'), previewTemplate);
router.post('/:type/generate', can('whatsapp', 'view'), generateMessage);

// Managing templates (edit content / reset to default) requires the
// stronger UPDATE permission — admins always pass; a plain Receptionist
// does NOT by default (see utils/seed.js); a custom role must be explicitly
// granted whatsapp.update ("template-management permission").
router.put('/:type', can('whatsapp', 'update'), updateTemplate);
router.post('/:type/reset', can('whatsapp', 'update'), resetTemplate);

module.exports = router;