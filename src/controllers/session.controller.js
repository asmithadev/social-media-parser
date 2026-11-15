const { z } = require('zod');
const prisma = require('../config/db-config');
const { caseScope, readInput, id, writeRecord } = require('../utils/records');

async function listSessions(req, res) {
  const input = readInput(req, res, ['panchnamaId']);
  if (!input) return;
  const panchnama = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, assignment: { case: caseScope(req.user) } },
    select: { sessions: { orderBy: { id: 'asc' } } },
  });
  if (!panchnama) return res.status(404).json({ message: 'Panchnama not found.' });
  return res.json(panchnama);
}


exports.listSessions = listSessions;

const createSessionSchema = z.strictObject({
  accountId: id,
  deviceType: z.enum(['macos', 'ios']),
  deviceLabel: z.string().trim().min(1).max(100).nullable().optional(),
  toolVersion: z.string().trim().min(1).max(30),
});

async function createSession(req, res) {
  if (req.user.role !== 'examiner') {
    return res.status(403).json({ message: 'Examiner access is required.' });
  }
  const input = readInput(req, res, ['panchnamaId'], createSessionSchema);
  if (!input) return;
  const panchnama = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, examinerId: req.user.id },
    select: { id: true, caseId: true },
  });
  if (!panchnama) return res.status(404).json({ message: 'Panchnama not found.' });

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: input.data.accountId,
      suspect: { caseSuspects: { some: { caseId: panchnama.caseId } } },
    },
    select: { id: true },
  });
  if (!account) return res.status(404).json({ message: 'Account not found in this case.' });
  return writeRecord(res, 201, 'session', () => prisma.captureSession.create({
    data: { panchnamaId: panchnama.id, ...input.data },
  }));
}


exports.createSession = createSession;

function sessionScope(user) {
  return { panchnama: { assignment: { case: caseScope(user) } } };
}

async function getSession(req, res) {
  const input = readInput(req, res, ['sessionId']);
  if (!input) return;
  const session = await prisma.captureSession.findFirst({
    where: { id: input.sessionId, ...sessionScope(req.user) },
  });
  if (!session) return res.status(404).json({ message: 'Session not found.' });
  return res.json({ session });
}


exports.getSession = getSession;
