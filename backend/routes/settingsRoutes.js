const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { uploadPhoto } = require('../middleware/upload');
const { getSettings, updateSettings, uploadLogo, uploadFavicon } = require('../controllers/settingsController');

const router = express.Router();

router.get('/', protect, getSettings);
router.put('/', protect, can('settings', 'update'), updateSettings);
router.post('/logo', protect, can('settings', 'update'), uploadPhoto.single('logo'), uploadLogo);
router.post('/favicon', protect, can('settings', 'update'), uploadPhoto.single('favicon'), uploadFavicon);

module.exports = router;