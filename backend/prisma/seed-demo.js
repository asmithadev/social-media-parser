require('dotenv').config();

const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const prisma = require('../src/config/db-config');
const ParsedArtifact = require('../src/models/parsed-artifact');
const connectMongo = require('../src/config/mongo-config');
const { readEvidenceBytes, writeEvidence } = require('../src/services/evidence-storage');
const renderReport = require('../src/utils/report-pdf');
const parseEvidence = require('../src/services/parse-evidence');

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD;
const DEMO_CASE_OPEN = 'DEMO-OPEN-001';
const DEMO_CASE_REPORT = 'DEMO-REPORT-001';
const DEMO_CASE_CLOSED = 'DEMO-CLOSED-001';
const DEMO_EXAMINER_EMAIL = 'demo.examiner@example.test';
const DEMO_REVIEWER_EMAIL = 'demo.reviewer@example.test';

const PLATFORM_SECTIONS = {
  facebook: ['account_info', 'posts', 'messages', 'timeline', 'friends', 'followers', 'following'],
  twitter: ['account_info', 'posts', 'messages', 'timeline', 'followers', 'following'],
  instagram: ['account_info', 'posts', 'messages', 'followers', 'following'],
  telegram: ['account_info', 'messages', 'friends'],
  whatsapp: ['account_info', 'messages', 'friends'],
  google: ['account_info', 'timeline', 'friends'],
};

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function assertSafeTarget() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const mongoUrl = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!databaseUrl || !mongoUrl) {
    throw new Error('Set DATABASE_URL and MONGO_URI/MONGODB_URI before seeding demo data.');
  }
  const remoteTarget = !isLoopback(new URL(databaseUrl).hostname) ||
    !isLoopback(new URL(mongoUrl).hostname) ||
    process.env.EVIDENCE_STORAGE === 'vercel-blob' || process.env.VERCEL === '1';
  if (remoteTarget && process.env.ALLOW_DEMO_DATA !== 'true') {
    throw new Error('Refusing to write demo data to remote databases or Blob storage. Set ALLOW_DEMO_DATA=true to opt in.');
  }
  if (typeof DEMO_PASSWORD !== 'string' || Buffer.byteLength(DEMO_PASSWORD, 'utf8') < 16 ||
      Buffer.byteLength(DEMO_PASSWORD, 'utf8') > 72) {
    throw new Error('Set DEMO_SEED_PASSWORD to a unique password between 16 and 72 bytes.');
  }
}

async function findOrCreate(find, create) {
  const found = await find();
  if (found) return found;
  try {
    return await create();
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const raced = await find();
    if (raced) return raced;
    throw error;
  }
}

async function fixtureUser(email, fullName, role, passwordHash) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role, passwordHash, active: true },
    create: { email, fullName, role, passwordHash },
  });
}

async function fixtureCase(caseNumber, title, description, createdBy, status = 'open') {
  return findOrCreate(
    () => prisma.case.findUnique({ where: { caseNumber } }),
    () => prisma.case.create({ data: { caseNumber, title, description, createdBy, status } }),
  );
}

async function fixtureAssignment(caseId, userId) {
  return findOrCreate(
    () => prisma.caseAssignment.findUnique({ where: { caseId_userId: { caseId, userId } } }),
    () => prisma.caseAssignment.create({ data: { caseId, userId, userNotes: 'Fictional demo assignment.' } }),
  );
}

async function fixtureSession(panchnamaId, accountId, deviceType, deviceLabel, status) {
  return findOrCreate(
    () => prisma.captureSession.findFirst({ where: { panchnamaId, accountId, deviceLabel } }),
    () => prisma.captureSession.create({
      data: {
        panchnamaId, accountId, deviceType, deviceLabel,
        toolVersion: 'demo-1.0.0', status,
        ...(status === 'completed' ? { endedAt: new Date() } : {}),
      },
    }),
  );
}

async function ensureEvidence(filePath, bytes, expectedHash, contentType) {
  const stored = await readEvidenceBytes(filePath);
  if (stored.bytes) {
    const actualHash = createHash('sha256').update(stored.bytes).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(`Existing demo evidence failed its integrity check: ${path.basename(filePath)}`);
    }
    return;
  }
  await writeEvidence(filePath, bytes, contentType);
}

async function fixtureScreenshot(session, section, sequenceNo, filePath, bytes, parsed) {
  const sha256Hash = createHash('sha256').update(bytes).digest('hex');
  const key = {
    sessionId_platformSectionId_sequenceNo: {
      sessionId: session.id, platformSectionId: section.id, sequenceNo,
    },
  };
  const screenshot = await findOrCreate(
    () => prisma.screenshot.findUnique({ where: key }),
    () => prisma.screenshot.create({
      data: {
        sessionId: session.id,
        platformSectionId: section.id,
        sequenceNo,
        filePath,
        sha256Hash,
        parseStatus: parsed ? 'parsed' : 'pending',
        sourceUrl: 'https://example.test/fictional-training-capture',
        metadata: { demo: true, fictional: true },
      },
    }),
  );
  await ensureEvidence(screenshot.filePath, bytes, screenshot.sha256Hash, 'image/png');

  if (parsed) {
    const text = 'TRAINING EVIDENCE 12345';
    await ParsedArtifact.updateOne(
      { screenshot_id: screenshot.id },
      {
        $setOnInsert: {
          screenshot_id: screenshot.id,
          text,
          structured: parseEvidence(text, { platform: 'whatsapp', section: 'messages' }),
          status: 'parsed', error: null,
          data: { engine: 'demo-fixture', language: 'eng', sha256Hash: screenshot.sha256Hash },
        },
      },
      { upsert: true },
    );
  }
  return screenshot;
}

async function fixtureOutcome(sessionId, sectionId, status, reason = null) {
  return findOrCreate(
    () => prisma.captureSectionOutcome.findUnique({
      where: { sessionId_platformSectionId: { sessionId, platformSectionId: sectionId } },
    }),
    () => prisma.captureSectionOutcome.create({
      data: { sessionId, platformSectionId: sectionId, status, reason },
    }),
  );
}

async function fixtureReport(panchnama, examinerId, artifact) {
  const key = { panchnamaId_versionNo: { panchnamaId: panchnama.id, versionNo: 1 } };
  const existing = await prisma.report.findUnique({ where: key });

  const record = await prisma.panchnama.findUnique({
    where: { id: panchnama.id },
    include: {
      assignment: { include: { case: { select: { caseNumber: true } }, user: { select: { fullName: true } } } },
      witnesses: { orderBy: { id: 'asc' }, select: { fullName: true } },
      sessions: {
        orderBy: { id: 'asc' },
        include: {
          account: {
            include: {
              platform: { include: { sections: { orderBy: { id: 'asc' } } } },
            },
          },
          outcomes: true,
          screenshots: { orderBy: [{ platformSectionId: 'asc' }, { sequenceNo: 'asc' }], include: { section: true } },
        },
      },
    },
  });
  const rendered = await renderReport(record, 1, [artifact]);
  if (!rendered.bytes) throw new Error('The demo report could not be rendered.');
  const sha256Hash = createHash('sha256').update(rendered.bytes).digest('hex');
  const filePath = existing?.filePath || `reports/demo-report-${sha256Hash.slice(0, 12)}.pdf`;
  if (existing) {
    const stored = await readEvidenceBytes(existing.filePath);
    if (stored.bytes) {
      const storedHash = createHash('sha256').update(stored.bytes).digest('hex');
      if (storedHash !== existing.sha256Hash) throw new Error('Existing demo report failed its integrity check.');
      return existing;
    }
  }
  await ensureEvidence(filePath, rendered.bytes, sha256Hash, 'application/pdf');
  if (existing) {
    return prisma.report.update({ where: { id: existing.id }, data: { sha256Hash } });
  }
  return prisma.report.create({
    data: { panchnamaId: panchnama.id, versionNo: 1, filePath, sha256Hash, generatedBy: examinerId },
  });
}

async function main() {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('Demo fixture seeding is disabled (set SEED_DEMO_DATA=true to enable).');
    return;
  }
  assertSafeTarget();
  await connectMongo();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const admin = adminEmail
    ? await prisma.user.findUnique({ where: { email: adminEmail } })
    : await prisma.user.findFirst({ where: { role: 'admin', active: true }, orderBy: { id: 'asc' } });
  if (!admin?.active || admin.role !== 'admin') {
    throw new Error('Run the standard seed first and ensure an active admin account exists.');
  }

  const examiner = await fixtureUser(DEMO_EXAMINER_EMAIL, 'Demo Examiner', 'examiner', passwordHash);
  const reviewer = await fixtureUser(DEMO_REVIEWER_EMAIL, 'Demo Reviewer', 'reviewer', passwordHash);

  const openCase = await fixtureCase(
    DEMO_CASE_OPEN, 'DEMO — Open capture workflow',
    'Fictional training data. Use this case to exercise an open capture session, OCR, evidence lookup, and screenshot endpoints.',
    admin.id,
  );
  const reportCase = await fixtureCase(
    DEMO_CASE_REPORT, 'DEMO — Report and approval workflow',
    'Fictional training data. This case has a completed capture, panchnama, witness, OCR artifact, and report.',
    admin.id,
  );
  const closedCase = await fixtureCase(
    DEMO_CASE_CLOSED, 'DEMO — Closed case filter',
    'Fictional training data for closed-case filtering and status display.',
    admin.id, 'closed',
  );

  for (const record of [openCase, reportCase, closedCase]) {
    await fixtureAssignment(record.id, examiner.id);
    await fixtureAssignment(record.id, reviewer.id);
  }

  const suspect = await findOrCreate(
    () => prisma.suspect.findFirst({ where: { alias: 'DEMO-SUSPECT-001' } }),
    () => prisma.suspect.create({
      data: { fullName: 'Fictional Training Subject', alias: 'DEMO-SUSPECT-001', dateOfBirth: new Date('1990-01-01T00:00:00Z') },
    }),
  );

  for (const record of [openCase, reportCase]) {
    await findOrCreate(
      () => prisma.caseSuspect.findUnique({ where: { caseId_suspectId: { caseId: record.id, suspectId: suspect.id } } }),
      () => prisma.caseSuspect.create({ data: { caseId: record.id, suspectId: suspect.id, involvement: 'suspect', involvementDetails: 'Fictional demo record.' } }),
    );
  }

  const accounts = {};
  const sections = {};
  for (const platformName of Object.keys(PLATFORM_SECTIONS)) {
    const platform = await prisma.platform.findUnique({ where: { name: platformName } });
    if (!platform?.active) throw new Error(`Platform seed is missing active platform: ${platformName}`);
    sections[platformName] = await prisma.platformSection.findMany({ where: { platformId: platform.id }, orderBy: { id: 'asc' } });
    accounts[platformName] = await findOrCreate(
      () => prisma.socialAccount.findFirst({ where: { suspectId: suspect.id, platformId: platform.id, handle: `demo_${platformName}_account` } }),
      () => prisma.socialAccount.create({
        data: {
          suspectId: suspect.id, platformId: platform.id, handle: `demo_${platformName}_account`,
          platformAccountId: `DEMO-${platformName.toUpperCase()}-001`,
          profileUrl: `https://example.test/${platformName}/demo-account`,
        },
      }),
    );
  }

  const messages = sections.whatsapp.find(section => section.sectionName === 'messages');
  if (!messages) throw new Error('The WhatsApp messages platform section is missing.');

  const openPanchnama = await findOrCreate(
    () => prisma.panchnama.findUnique({ where: { panchnamaNo: 'DEMO-PANCH-OPEN-001' } }),
    () => prisma.panchnama.create({
      data: {
        panchnamaNo: 'DEMO-PANCH-OPEN-001', caseId: openCase.id, examinerId: examiner.id,
        authorityRef: 'DEMO-TRAINING-AUTHORITY', location: 'Fictional Training Lab',
        heldAt: new Date('2026-11-20T09:00:00Z'),
      },
    }),
  );
  const reportPanchnama = await findOrCreate(
    () => prisma.panchnama.findUnique({ where: { panchnamaNo: 'DEMO-PANCH-REPORT-001' } }),
    () => prisma.panchnama.create({
      data: {
        panchnamaNo: 'DEMO-PANCH-REPORT-001', caseId: reportCase.id, examinerId: examiner.id,
        authorityRef: 'DEMO-TRAINING-AUTHORITY', location: 'Fictional Review Room',
        heldAt: new Date('2026-11-21T10:30:00Z'),
      },
    }),
  );

  await findOrCreate(
    () => prisma.witness.findFirst({ where: { panchnamaId: reportPanchnama.id, fullName: 'Fictional Demo Witness' } }),
    () => prisma.witness.create({ data: { panchnamaId: reportPanchnama.id, fullName: 'Fictional Demo Witness' } }),
  );

  const openSession = await fixtureSession(openPanchnama.id, accounts.whatsapp.id, 'macos', 'Demo Mac — open session', 'open');
  const reportSession = await fixtureSession(reportPanchnama.id, accounts.whatsapp.id, 'ios', 'Demo iPhone — completed session', 'completed');

  const png = await fs.readFile(path.join(__dirname, '../tests/fixtures/ocr-sample.png'));
  const openScreenshot = await fixtureScreenshot(openSession, messages, 1, 'screenshots/demo-open-session.png', png, true);
  const reportScreenshot = await fixtureScreenshot(reportSession, messages, 1, 'screenshots/demo-report-session.png', png, true);

  await fixtureOutcome(openSession.id, messages.id, 'captured');
  for (const section of sections.whatsapp) {
    await fixtureOutcome(reportSession.id, section.id,
      section.id === messages.id ? 'captured' : 'skipped',
      section.id === messages.id ? null : 'Not included in the fictional training capture.',
    );
  }

  const artifact = await ParsedArtifact.findOne({ screenshot_id: reportScreenshot.id }).select('-_id').lean();
  if (!artifact) throw new Error('The report-ready demo OCR artifact is missing.');
  const report = await fixtureReport(reportPanchnama, examiner.id, artifact);

  console.log(JSON.stringify({
    status: 'demo fixtures ready',
    login: {
      examiner: DEMO_EXAMINER_EMAIL,
      reviewer: DEMO_REVIEWER_EMAIL,
      password: 'the DEMO_SEED_PASSWORD environment value',
    },
    cases: { open: openCase.id, reportReady: reportCase.id, closed: closedCase.id },
    suspect: suspect.id,
    accounts: Object.fromEntries(Object.entries(accounts).map(([name, account]) => [name, account.id])),
    panchnamas: { open: openPanchnama.id, reportReady: reportPanchnama.id },
    sessions: { open: openSession.id, completed: reportSession.id },
    screenshots: { open: openScreenshot.id, reportReady: reportScreenshot.id },
    report: report.id,
    note: 'All person, case, account, screenshot, and OCR content is fictional.',
  }, null, 2));
}

main()
  .catch(error => {
    console.error('Demo fixture seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([prisma.$disconnect(), mongoose.disconnect()]);
  });
