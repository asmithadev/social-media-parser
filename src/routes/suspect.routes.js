const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const controller = require('../controllers/suspect.controller');

const router = express.Router();
router.get('/suspects', requireAuth, controller.listSuspects);

module.exports = router;
