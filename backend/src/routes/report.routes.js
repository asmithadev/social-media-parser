const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/report.controller');

const router = express.Router();
router.get('/panchnamas/:panchnamaId/reports', requireAuth, controller.listReports);

router.get('/reports/:reportId', requireAuth, controller.getReport);

router.post('/panchnamas/:panchnamaId/reports', requireAuth, controller.generateReport);

router.get('/reports/:reportId/file', requireAuth, controller.downloadReport);

router.post('/reports/:reportId/approve', requireAuth, controller.approveReport);

router.post('/reports/:reportId/print-requests', requireAuth, controller.requestPrint);

module.exports = router;
