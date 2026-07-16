const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadPhoto } = require('../middleware/upload');
const { getSettings, updateSettings, uploadLogo, uploadFavicon } = require('../controllers/settingsController');

const router = express.Router();

router.get('/', protect, getSettings);
router.put('/', protect, authorize('admin'), updateSettings);
router.post('/logo', protect, authorize('admin'), uploadPhoto.single('logo'), uploadLogo);
router.post('/favicon', protect, authorize('admin'), uploadPhoto.single('favicon'), uploadFavicon);

module.exports = router;