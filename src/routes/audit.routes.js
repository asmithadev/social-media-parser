const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listAuditLogs } = require('../controllers/audit.controller');

const router = express.Router();
router.get('/audit-logs', requireAuth, requireAdmin, listAuditLogs);

module.exports = router;
