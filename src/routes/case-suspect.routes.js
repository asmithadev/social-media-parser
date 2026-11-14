const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const controller = require('../controllers/case-suspect.controller');

const router = express.Router();
router.get('/cases/:caseId/suspects', requireAuth, controller.listLinks);
router.post('/cases/:caseId/suspects', requireAuth, requireAdmin, controller.linkSuspect);

module.exports = router;
