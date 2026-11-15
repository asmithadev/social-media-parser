const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/report.controller');

const router = express.Router();
router.get('/panchnamas/:panchnamaId/reports', requireAuth, controller.listReports);

module.exports = router;
