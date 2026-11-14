const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listCases, createCase } = require('../controllers/case.controller');

const router = express.Router();
router.use(requireAuth);
router.get('/', listCases);
router.post('/', requireAdmin, createCase);


module.exports = router;
