const express = require('express');
const requireAuth = require('../middleware/require-auth');
const requireAdmin = require('../middleware/require-admin');
const { listCases, createCase, getCase, updateCase, listAssignments, createAssignment } = require('../controllers/case.controller');

const router = express.Router();
router.use(requireAuth);
router.get('/', listCases);
router.post('/', requireAdmin, createCase);
router.get('/:caseId', getCase);

router.patch('/:caseId', requireAdmin, updateCase);
router.get('/:caseId/assignments', listAssignments);
router.post('/:caseId/assignments', requireAdmin, createAssignment);

module.exports = router;
