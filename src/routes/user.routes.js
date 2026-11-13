const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listUsers, createUser } = require('../controllers/user.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listUsers);
router.post('/', createUser);

module.exports = router;
