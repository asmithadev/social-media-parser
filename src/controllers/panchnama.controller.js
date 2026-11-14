const { z } = require('zod');
const prisma = require('../config/db-config');
const { caseScope, readInput, writeRecord } = require('../utils/records');


const createSchema = z.strictObject({
  panchnamaNo: z.string().trim().min(1).max(50),
  authorityRef: z.string().trim().min(1).max(100),
  location: z.string().trim().min(1).max(255),
  heldAt: z.iso.datetime({ offset: true }).transform(value => new Date(value)),
});

function panchnamaScope(user) {
  return { assignment: { case: caseScope(user) } };
}

async function listPanchnamas(req, res) {
  const input = readInput(req, res, ['caseId']);
  if (!input) return;
  const record = await prisma.case.findFirst({
    where: { id: input.caseId, ...caseScope(req.user) },
    select: { assignments: { select: { panchnamas: true } } },
  });
  if (!record) return res.status(404).json({ message: 'Case not found.' });
  const panchnamas = record.assignments.flatMap(assignment => assignment.panchnamas);
  return res.json({ panchnamas: panchnamas.sort((first, second) => first.id - second.id) });
}

async function createPanchnama(req, res) {
  if (req.user.role !== 'examiner') {
    return res.status(403).json({ message: 'Examiner access is required.' });
  }
  const input = readInput(req, res, ['caseId'], createSchema);
  if (!input) return;
  const assignment = await prisma.caseAssignment.findUnique({
    where: { caseId_userId: { caseId: input.caseId, userId: req.user.id } },
    select: { id: true },
  });
  if (!assignment) return res.status(404).json({ message: 'Assigned case not found.' });
  return writeRecord(res, 201, 'panchnama', () => prisma.panchnama.create({
    data: { caseId: input.caseId, examinerId: req.user.id, ...input.data },
  }));
}

module.exports = { listPanchnamas, createPanchnama };
