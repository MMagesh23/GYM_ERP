const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { uploadPhoto, verifyImageBuffer } = require('../middleware/upload');
const { getSettings, updateSettings, uploadLogo, uploadFavicon } = require('../controllers/settingsController');

const router = express.Router();

router.get('/', protect, getSettings);
router.put('/', protect, can('settings', 'update'), updateSettings);
router.post('/logo', protect, can('settings', 'update'), uploadPhoto.single('logo'), verifyImageBuffer, uploadLogo);
router.post('/favicon', protect, can('settings', 'update'), uploadPhoto.single('favicon'), verifyImageBuffer, uploadFavicon);

// settingsRoutes.js

module.exports = router;