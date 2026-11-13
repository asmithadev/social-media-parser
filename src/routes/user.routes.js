const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listUsers } = require('../controllers/user.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listUsers);

module.exports = router;
