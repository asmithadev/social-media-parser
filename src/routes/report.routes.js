const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/report.controller');

const router = express.Router();
router.get('/panchnamas/:panchnamaId/reports', requireAuth, controller.listReports);

router.get('/reports/:reportId', requireAuth, controller.getReport);

module.exports = router;
