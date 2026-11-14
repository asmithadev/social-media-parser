const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listCases, createCase, getCase, updateCase } = require('../controllers/case.controller');

const router = express.Router();
router.use(requireAuth);
router.get('/', listCases);
router.post('/', requireAdmin, createCase);
router.get('/:caseId', getCase);

router.patch('/:caseId', requireAdmin, updateCase);

module.exports = router;
