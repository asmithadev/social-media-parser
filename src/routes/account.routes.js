const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const controller = require('../controllers/account.controller');

const router = express.Router();
router.get('/suspects/:suspectId/accounts', requireAuth, controller.listAccounts);
router.post('/suspects/:suspectId/accounts', requireAuth, requireAdmin, controller.createAccount);

module.exports = router;
