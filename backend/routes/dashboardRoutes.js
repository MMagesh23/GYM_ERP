const express = require('express');
const { protect } = require('../middleware/auth');
const { can } = require('../middleware/rbac');
const { summary, charts } = require('../controllers/dashboardController');

const router = express.Router();


router.get('/summary', protect, can('dashboard', 'view'), summary);
router.get('/charts', protect, can('dashboard', 'view'), charts);

module.exports = router;
