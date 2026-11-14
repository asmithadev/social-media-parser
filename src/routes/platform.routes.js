const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/platform.controller');

const router = express.Router();
router.get('/platforms', requireAuth, controller.listPlatforms);

module.exports = router;
