const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/panchnama.controller');

const router = express.Router();
router.get('/cases/:caseId/panchnamas', requireAuth, controller.listPanchnamas);
router.post('/cases/:caseId/panchnamas', requireAuth, controller.createPanchnama);
router.get('/panchnamas/:panchnamaId', requireAuth, controller.getPanchnama);


module.exports = router;
