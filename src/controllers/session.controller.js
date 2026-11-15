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

const finishSchema = z.strictObject({ status: z.enum(['completed', 'failed']) });

async function finishSession(req, res) {
  if (req.user.role !== 'examiner') {
    return res.status(403).json({ message: 'Examiner access is required.' });
  }
  const input = readInput(req, res, ['sessionId'], finishSchema);
  if (!input) return;
  const where = { id: input.sessionId, panchnama: { examinerId: req.user.id } };
  const session = await prisma.captureSession.findFirst({ where });
  if (!session) return res.status(404).json({ message: 'Session not found.' });
  if (session.status === input.data.status) return res.json({ session });

  const [updated] = await prisma.captureSession.updateManyAndReturn({
    where: { ...where, status: 'open' },
    data: { status: input.data.status, endedAt: new Date(Math.max(Date.now(), session.startedAt.getTime())) },
  });
  if (updated) return res.json({ session: updated });

  const current = await prisma.captureSession.findFirst({ where });
  if (!current) return res.status(404).json({ message: 'Session not found.' });
  if (current.status === input.data.status) return res.json({ session: current });
  return res.status(409).json({ message: 'Session has already ended.' });
}


exports.finishSession = finishSession;

async function listSections(req, res) {
  const input = readInput(req, res, ['sessionId']);
  if (!input) return;
  const session = await prisma.captureSession.findFirst({
    where: { id: input.sessionId, ...sessionScope(req.user) },
    select: {
      account: { select: { platform: { select: { sections: { orderBy: { id: 'asc' } } } } } },
      outcomes: true,
    },
  });
  if (!session) return res.status(404).json({ message: 'Session not found.' });
  const outcomes = new Map(session.outcomes.map(outcome => [outcome.platformSectionId, outcome]));
  const sections = session.account.platform.sections.map(section => {
    const outcome = outcomes.get(section.id);
    return { ...section, status: outcome?.status ?? 'pending', reason: outcome?.reason ?? null };
  });
  return res.json({ sections });
}


exports.listSections = listSections;

const outcomeSchema = z.strictObject({
  status: z.enum(['captured', 'failed', 'skipped']),
  reason: z.string().trim().min(1).max(1000).nullable().optional(),
}).refine(data => data.status === 'captured' || Boolean(data.reason), {
  path: ['reason'],
  message: 'Provide a reason for a failed or skipped section.',
});

async function setSectionOutcome(req, res) {
  if (req.user.role !== 'examiner') {
    return res.status(403).json({ message: 'Examiner access is required.' });
  }
  const input = readInput(req, res, ['sessionId', 'sectionId'], outcomeSchema);
  if (!input) return;
  const { sessionId, sectionId, data } = input;
  const result = await prisma.$transaction(async tx => {
    // Serialize outcome updates against the session's final status update.
    await tx.$queryRaw`SELECT s.session_id FROM capture_sessions s
      JOIN panchnamas p ON p.panchnama_id = s.panchnama_id
      WHERE s.session_id = ${sessionId} AND p.examiner_id = ${req.user.id}
      FOR UPDATE OF s`;
    const session = await tx.captureSession.findFirst({
      where: { id: sessionId, panchnama: { examinerId: req.user.id } },
      select: { status: true, account: { select: { platformId: true } } },
    });
    if (!session) return { status: 404, message: 'Session not found.' };
    if (session.status !== 'open') return { status: 409, message: 'Session has already ended.' };
    const section = await tx.platformSection.findFirst({
      where: { id: sectionId, platformId: session.account.platformId },
      select: { id: true },
    });
    if (!section) return { status: 404, message: 'Section not found for this platform.' };

    const key = { sessionId, platformSectionId: sectionId };
    const outcome = { status: data.status, reason: data.reason ?? null };
    return { outcome: await tx.captureSectionOutcome.upsert({
      where: { sessionId_platformSectionId: key },
      create: { ...key, ...outcome },
      update: outcome,
    }) };
  });
  if (!result.outcome) return res.status(result.status).json({ message: result.message });
  return res.json(result);
}


exports.setSectionOutcome = setSectionOutcome;

async function listScreenshots(req, res) {
  const input = readInput(req, res, ['sessionId']);
  if (!input) return;
  const session = await prisma.captureSession.findFirst({
    where: { id: input.sessionId, ...sessionScope(req.user) },
    select: {
      screenshots: {
        orderBy: [{ platformSectionId: 'asc' }, { sequenceNo: 'asc' }],
        omit: { filePath: true },
      },
    },
  });
  if (!session) return res.status(404).json({ message: 'Session not found.' });
  return res.json(session);
}


exports.listScreenshots = listScreenshots;

async function getScreenshot(req, res) {
  const input = readInput(req, res, ['screenshotId']);
  if (!input) return;
  const screenshot = await prisma.screenshot.findFirst({
    where: { id: input.screenshotId, session: sessionScope(req.user) },
    omit: { filePath: true },
  });
  if (!screenshot) return res.status(404).json({ message: 'Screenshot not found.' });
  return res.json({ screenshot });
}

exports.getScreenshot = getScreenshot;
