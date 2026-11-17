const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listLogs, verifyChain } = require('../controllers/audit.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listLogs);
router.get('/verify', verifyChain);

module.exports = router;
