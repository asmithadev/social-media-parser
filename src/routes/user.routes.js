const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listUsers, createUser, updateUser } = require('../controllers/user.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:userId', updateUser);

module.exports = router;
