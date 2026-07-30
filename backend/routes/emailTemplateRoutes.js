const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  listTemplates,
  getTemplate,
  updateTemplate,
  resetTemplate,
  previewTemplate,
} = require('../controllers/emailTemplateController');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', listTemplates);
router.get('/:type', getTemplate);
router.put('/:type', updateTemplate);
router.post('/:type/reset', resetTemplate);
router.post('/:type/preview', previewTemplate);

module.exports = router;
