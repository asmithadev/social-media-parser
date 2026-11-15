const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/session.controller');

const router = express.Router();

router.get('/panchnamas/:panchnamaId/sessions', requireAuth, controller.listSessions);

router.post('/panchnamas/:panchnamaId/sessions', requireAuth, controller.createSession);

module.exports = router;
