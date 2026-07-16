const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = express.Router();

router.get('/', protect, getSettings); // both roles can view
router.put('/', protect, authorize('admin'), updateSettings); // only admin can change

module.exports = router;
