const express = require('express');
const { protect } = require('../middleware/auth');
const { summary, charts } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', protect, summary);
router.get('/charts', protect, charts);

module.exports = router;
