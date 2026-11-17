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
  return writeRecord(res, 201, 'panchnama', req.user.id, tx => tx.panchnama.create({
    data: { caseId: input.caseId, examinerId: req.user.id, ...input.data },
  }));
}

async function getPanchnama(req, res) {
  const input = readInput(req, res, ['panchnamaId']);
  if (!input) return;
  const panchnama = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, ...panchnamaScope(req.user) },
  });
  if (!panchnama) return res.status(404).json({ message: 'Panchnama not found.' });
  return res.json({ panchnama });
}

async function listWitnesses(req, res) {
  const input = readInput(req, res, ['panchnamaId']);
  if (!input) return;
  const panchnama = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, ...panchnamaScope(req.user) },
    select: { witnesses: { orderBy: { id: 'asc' }, select: { id: true, fullName: true } } },
  });
  if (!panchnama) return res.status(404).json({ message: 'Panchnama not found.' });
  return res.json(panchnama);
}

const witnessSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(150),
  contactNo: z.string().trim().min(1).max(15).nullable().optional(),
  aadharNumber: z.string().regex(/^[0-9]{12}$/).nullable().optional(),
});

async function createWitness(req, res) {
  if (req.user.role !== 'examiner') {
    return res.status(403).json({ message: 'Examiner access is required.' });
  }
  const input = readInput(req, res, ['panchnamaId'], witnessSchema);
  if (!input) return;
  const panchnama = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, examinerId: req.user.id },
    select: { id: true },
  });
  if (!panchnama) return res.status(404).json({ message: 'Panchnama not found.' });
  return writeRecord(res, 201, 'witness', req.user.id, tx => tx.witness.create({
    data: { panchnamaId: panchnama.id, ...input.data },
    select: { id: true, fullName: true },
  }));
}

module.exports = { listPanchnamas, createPanchnama, getPanchnama, listWitnesses, createWitness };
