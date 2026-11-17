const { createHash, randomUUID } = require('node:crypto');
const { mkdir, readFile, realpath, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { z } = require('zod');
const ParsedArtifact = require('../models/parsed-artifact');
const recordId = require('../utils/record-id');
const prisma = require('../config/db-config');
const { caseScope, readInput, id, writeRecord } = require('../utils/records');
const { withAuditActor } = require('../services/audit');

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
  return writeRecord(res, 201, 'session', req.user.id, tx => tx.captureSession.create({
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

  const [updated] = await withAuditActor(req.user.id, tx => tx.captureSession.updateManyAndReturn({
    where: { ...where, status: 'open' },
    data: { status: input.data.status, endedAt: new Date(Math.max(Date.now(), session.startedAt.getTime())) },
  }));
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
  const result = await withAuditActor(req.user.id, async tx => {
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

const uploadQuery = z.strictObject({
  sectionId: recordId,
  sequenceNo: recordId,
  sourceUrl: z.url({ protocol: /^https?$/ }).optional(),
});
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

async function uploadScreenshot(req, res) {
  if (req.user.role !== 'examiner') {
    return res.status(403).json({ message: 'Examiner access is required.' });
  }
  const input = readInput(req, res, ['sessionId']);
  if (!input) return;
  const query = uploadQuery.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ message: 'Provide a valid sectionId and sequenceNo.' });
  }
  if (!req.is('image/png')) {
    return res.status(415).json({ message: 'Send the screenshot as image/png.' });
  }
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || !bytes.subarray(0, 8).equals(pngSignature) ||
      bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    return res.status(400).json({ message: 'The request body does not start with a PNG header.' });
  }

  const { sessionId } = input;
  const { sectionId, sequenceNo, sourceUrl } = query.data;
  const sha256Hash = createHash('sha256').update(bytes).digest('hex');
  const filePath = path.join('screenshots', randomUUID() + '.png');
  const absolutePath = path.resolve(process.env.EVIDENCE_DIR || 'evidence', filePath);

  let result;
  try {
    result = await withAuditActor(req.user.id, async tx => {
      // Use the same session lock as section updates and session completion.
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

      // Create the row first so a duplicate sequence never writes a file.
      const screenshot = await tx.screenshot.create({
        data: { sessionId, platformSectionId: sectionId, sequenceNo, sourceUrl, sha256Hash, filePath },
        omit: { filePath: true },
      });
      await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
      await writeFile(absolutePath, bytes, { flag: 'wx', mode: 0o600, flush: true });
      return { screenshot };
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'This screenshot sequence number is already in use.' });
    }
    throw error;
  }
  if (!result.screenshot) return res.status(result.status).json({ message: result.message });
  return res.status(201).json(result);
}

exports.uploadScreenshot = uploadScreenshot;

async function downloadScreenshot(req, res) {
  const input = readInput(req, res, ['screenshotId']);
  if (!input) return;
  const screenshot = await prisma.screenshot.findFirst({
    where: { id: input.screenshotId, session: sessionScope(req.user) },
    select: { filePath: true, sha256Hash: true },
  });
  if (!screenshot) return res.status(404).json({ message: 'Screenshot not found.' });

  let bytes;
  try {
    const root = await realpath(process.env.EVIDENCE_DIR || 'evidence');
    const target = await realpath(path.resolve(root, screenshot.filePath));
    const relative = path.relative(root, target);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      return res.status(404).json({ message: 'Screenshot file not found.' });
    }
    bytes = await readFile(target);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return res.status(404).json({ message: 'Screenshot file not found.' });
    }
    throw error;
  }

  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== screenshot.sha256Hash) {
    return res.status(409).json({ message: 'Screenshot file failed its integrity check.' });
  }
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return res.attachment('screenshot-' + input.screenshotId + '.png').send(bytes);
}

exports.downloadScreenshot = downloadScreenshot;

async function getParsedArtifact(req, res) {
  const input = readInput(req, res, ['screenshotId']);
  if (!input) return;
  const screenshot = await prisma.screenshot.findFirst({
    where: { id: input.screenshotId, session: sessionScope(req.user) },
    select: { id: true, parseStatus: true },
  });
  if (!screenshot) return res.status(404).json({ message: 'Screenshot not found.' });

  const artifact = await ParsedArtifact.findOne({ screenshot_id: screenshot.id }).select('-_id').lean();
  if (!artifact) {
    return res.status(404).json({ message: 'Parsed artifact not found.', parseStatus: screenshot.parseStatus });
  }
  return res.json({ artifact });
}

exports.getParsedArtifact = getParsedArtifact;

const artifactQuery = z.strictObject({
  q: z.string().trim().min(1).max(150),
  after: recordId.optional(),
});

async function searchParsedArtifacts(req, res) {
  const input = readInput(req, res, ['caseId']);
  if (!input) return;
  const query = artifactQuery.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: 'Provide a valid search query and optional cursor.' });

  const { caseId } = input;
  const record = await prisma.case.findFirst({
    where: { id: caseId, ...caseScope(req.user) },
    select: { id: true },
  });
  if (!record) return res.status(404).json({ message: 'Case not found.' });

  const text = query.data.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const artifacts = [];
  let cursor = query.data.after ?? 0;
  // Walk authorized screenshot IDs in bounded batches before querying MongoDB.
  while (artifacts.length < 51) {
    const screenshots = await prisma.screenshot.findMany({
      where: {
        id: { gt: cursor },
        session: { panchnama: { caseId, assignment: { case: caseScope(req.user) } } },
      },
      orderBy: { id: 'asc' },
      select: { id: true },
      take: 250,
    });
    if (!screenshots.length) break;
    const matches = await ParsedArtifact.find({
      screenshot_id: { $in: screenshots.map(screenshot => screenshot.id) },
      text: { $regex: text, $options: 'i' },
    }).select('screenshot_id text -_id').sort({ screenshot_id: 1 }).limit(51 - artifacts.length).lean();
    artifacts.push(...matches);
    cursor = screenshots.at(-1).id;
    if (screenshots.length < 250) break;
  }
  return res.json({
    artifacts: artifacts.slice(0, 50),
    nextCursor: artifacts.length > 50 ? artifacts[49].screenshot_id : null,
  });
}

exports.searchParsedArtifacts = searchParsedArtifacts;
