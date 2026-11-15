const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/session.controller');

const router = express.Router();

router.get('/panchnamas/:panchnamaId/sessions', requireAuth, controller.listSessions);

router.post('/panchnamas/:panchnamaId/sessions', requireAuth, controller.createSession);

router.get('/sessions/:sessionId', requireAuth, controller.getSession);

router.patch('/sessions/:sessionId', requireAuth, controller.finishSession);

router.get('/sessions/:sessionId/sections', requireAuth, controller.listSections);

router.patch('/sessions/:sessionId/sections/:sectionId', requireAuth, controller.setSectionOutcome);

router.get('/sessions/:sessionId/screenshots', requireAuth, controller.listScreenshots);

router.post('/sessions/:sessionId/screenshots',
  requireAuth, express.raw({ type: 'image/png', limit: '10mb', inflate: false }),
  controller.uploadScreenshot);

router.get('/screenshots/:screenshotId', requireAuth, controller.getScreenshot);

module.exports = router;
