const { z } = require('zod');
const prisma = require('../config/db-config');
const recordId = require('../utils/record-id');
const { caseScope, id, readInput, writeRecord } = require('../utils/records');

const createCaseSchema = z.strictObject({
  caseNumber: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().nullable().optional(),
});

async function listCases(req, res) {
  const cases = await prisma.case.findMany({ where: caseScope(req.user), orderBy: { id: 'asc' } });
  return res.json({ cases });
}

const updateCaseSchema = createCaseSchema.partial().extend({
  status: z.enum(['open', 'closed']).optional(),
}).refine(data => Object.keys(data).length > 0);

const assignmentSchema = z.strictObject({
  userId: id,
  userNotes: z.string().trim().nullable().optional(),
});

module.exports = { listCases };
