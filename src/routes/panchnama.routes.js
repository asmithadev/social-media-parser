const express = require('express');
const requireAuth = require('../middleware/require-auth');
const controller = require('../controllers/panchnama.controller');

const router = express.Router();
router.get('/cases/:caseId/panchnamas', requireAuth, controller.listPanchnamas);


module.exports = router;
