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

async function createCase(req, res) {
  const input = createCaseSchema.safeParse(req.body);
  if (!input.success) {
    return res.status(400).json({ message: 'Provide a valid case number and title.' });
  }

  try {
    const record = await prisma.case.create({ data: { ...input.data, createdBy: req.user.id } });
    return res.status(201).json({ case: record });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'That case number already exists.' });
    }
    throw error;
  }
}

async function getCase(req, res) {
  const id = recordId.safeParse(req.params.caseId);
  if (!id.success) {
    return res.status(400).json({ message: 'Provide a valid case ID.' });
  }

  const record = await prisma.case.findFirst({ where: { id: id.data, ...caseScope(req.user) } });
  if (!record) {
    return res.status(404).json({ message: 'Case not found.' });
  }
  return res.json({ case: record });
}

const updateCaseSchema = createCaseSchema.partial().extend({
  status: z.enum(['open', 'closed']).optional(),
}).refine(data => Object.keys(data).length > 0);

async function updateCase(req, res) {
  const input = readInput(req, res, ['caseId'], updateCaseSchema);
  if (!input) return;
  return writeRecord(res, 200, 'case', () =>
    prisma.case.update({ where: { id: input.caseId }, data: input.data }));
}

const assignmentSchema = z.strictObject({
  userId: id,
  userNotes: z.string().trim().nullable().optional(),
});

async function listAssignments(req, res) {
  const input = readInput(req, res, ['caseId']);
  if (!input) return;
  const record = await prisma.case.findFirst({
    where: { id: input.caseId, ...caseScope(req.user) },
    select: { assignments: { orderBy: { id: 'asc' } } },
  });
  if (!record) return res.status(404).json({ message: 'Case not found.' });
  return res.json(record);
}

async function createAssignment(req, res) {
  const input = readInput(req, res, ['caseId'], assignmentSchema);
  if (!input) return;
  const user = await prisma.user.findFirst({
    where: { id: input.data.userId, active: true, role: { in: ['examiner', 'reviewer'] } },
    select: { id: true },
  });
  if (!user) return res.status(404).json({ message: 'Active examiner or reviewer not found.' });
  return writeRecord(res, 201, 'assignment', () =>
    prisma.caseAssignment.create({ data: { caseId: input.caseId, ...input.data } }));
}

module.exports = { listCases, createCase, getCase, updateCase, listAssignments, createAssignment };
