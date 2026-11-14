const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const controller = require('../controllers/suspect.controller');

const router = express.Router();
router.get('/suspects', requireAuth, controller.listSuspects);
router.post('/suspects', requireAuth, requireAdmin, controller.createSuspect);

module.exports = router;
