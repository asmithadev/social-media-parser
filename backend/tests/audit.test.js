const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const path = require('node:path');

test('PostgreSQL audit trail and API', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to a PostgreSQL test database; psql must be installed.',
}, async t => {
  const { PrismaClient } = require('@prisma/client');
  const schema = 'audit_test_' + randomUUID().replaceAll('-', '');
  const baseUrl = new URL(process.env.TEST_DATABASE_URL);
  baseUrl.searchParams.delete('schema');
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  process.env.JWT_SECRET = 'audit-integration-test-secret';
  const setup = new PrismaClient({ datasourceUrl: baseUrl.toString() });
  const prisma = require('../src/config/db-config');
  const { withAuditActor, recordLogin } = require('../src/services/audit');
  let server;

  // Every run owns one random schema. No existing application data is changed.
  try {
    await setup.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    for (const migration of readdirSync(path.join(__dirname, '../prisma/migrations')).filter(name => /^\d/.test(name)).sort()) {
      execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', baseUrl.toString(),
        '-f', path.join(__dirname, '../prisma/migrations', migration, 'migration.sql')], {
        env: { ...process.env, PGOPTIONS: `-c search_path=${schema},public` }, stdio: 'pipe',
      });
    }
    const [empty] = await prisma.$queryRaw`SELECT * FROM verify_audit_chain()`;
    assert.equal(empty.valid, true);
    assert.equal(empty.checked, 0n);
    assert.equal(empty.head_id, null);
    assert.equal(empty.head_hash, '0'.repeat(64));
    const app = require('../src/app');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    const password = 'private-test-password';
    const passwordHash = await bcrypt.hash(password, 4);
    const users = {};
    for (const role of ['admin', 'examiner', 'reviewer']) {
      users[role] = await prisma.user.create({ data: { email: `${role}@example.test`, fullName: role, role, passwordHash } });
    }
    const tokens = Object.fromEntries(Object.entries(users).map(([role, user]) => [role,
      jwt.sign({}, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: '1h', algorithm: 'HS256' })]));
    async function request(method, endpoint, role = 'admin', body) {
      const response = await fetch(origin + endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    }
    async function ok(method, endpoint, role, body) {
      const result = await request(method, endpoint, role, body);
      assert.ok(result.status >= 200 && result.status < 300, JSON.stringify(result));
      return result.body;
    }
    async function verify(tx = prisma) {
      const [result] = await tx.$queryRaw`SELECT * FROM verify_audit_chain()`;
      return result;
    }

    await t.test('independent SHA-256 calculation', async () => {
      const entry = await prisma.auditLog.findFirst({ orderBy: { id: 'asc' } });
      const [{ timestamp }] = await prisma.$queryRaw`SELECT to_char(logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS timestamp FROM audit_logs WHERE log_id = ${entry.id}`;
      const payload = ['audit-v1', '0'.repeat(64), entry.id.toString(), entry.userId,
        entry.action, entry.entityType, entry.entityId, entry.detail, timestamp];
      const expected = createHash('sha256').update('[' + payload.map(value => JSON.stringify(value)).join(', ') + ']').digest('hex');
      assert.equal(entry.chainHash, expected);
      assert.equal((await verify()).valid, true);
    });

    await t.test('successful, wrong-password, unknown-user, and invalid-body logins are recorded without credentials', async () => {
      const start = await prisma.auditLog.count();
      const success = await request('POST', '/api/auth/login', null, { email: users.admin.email, password });
      assert.equal(success.status, 200);
      assert.equal((await request('POST', '/api/auth/login', null, { email: users.admin.email, password: 'wrong' })).status, 401);
      assert.equal((await request('POST', '/api/auth/login', null, { email: 'unknown@example.test', password })).status, 401);
      assert.equal((await request('POST', '/api/auth/login', null, {})).status, 400);
      const events = await prisma.auditLog.findMany({ orderBy: { id: 'asc' }, skip: start });
      assert.deepEqual(events.map(event => event.action), ['LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGIN_FAILED', 'LOGIN_FAILED']);
      assert.equal(events[0].userId, users.admin.id);
      assert.ok(events.slice(1).every(event => event.userId === null));
      for (const event of events) {
        assert.ok(!event.detail.includes(password));
        assert.ok(!event.detail.includes(success.body.accessToken));
        assert.ok(!event.detail.includes(users.admin.email));
      }
    });

    let caseId, sessionId, platformId, sectionId, panchnamaId;
    await t.test('all existing record and capture writes carry the authenticated actor', async () => {
      const start = await prisma.auditLog.count();
      const createdUser = (await ok('POST', '/api/users', 'admin', {
        email: 'new@example.test', fullName: 'Sensitive Name', role: 'examiner', password,
      })).user;
      await ok('PATCH', `/api/users/${createdUser.id}`, 'admin', { fullName: 'Changed Name' });
      const record = (await ok('POST', '/api/cases', 'admin', { caseNumber: 'AUDIT-1', title: 'Test Case' })).case;
      caseId = record.id;
      await ok('PATCH', `/api/cases/${caseId}`, 'admin', { title: 'Updated Case' });
      await ok('POST', `/api/cases/${caseId}/assignments`, 'admin', { userId: users.examiner.id });
      const suspect = (await ok('POST', '/api/suspects', 'admin', { fullName: 'Private Suspect', aadharNumber: '123456789012' })).suspect;
      await ok('PATCH', `/api/suspects/${suspect.id}`, 'admin', { alias: 'Private Alias' });
      await ok('POST', `/api/cases/${caseId}/suspects`, 'admin', { suspectId: suspect.id, involvement: 'suspect' });
      await ok('PATCH', `/api/cases/${caseId}/suspects/${suspect.id}`, 'admin', { involvement: 'accused' });
      const platform = await withAuditActor(users.admin.id, tx => tx.platform.create({
        data: { name: 'audit_platform', sections: { create: { sectionName: 'posts' } } }, include: { sections: true },
      }));
      platformId = platform.id;
      sectionId = platform.sections[0].id;
      const account = (await ok('POST', `/api/suspects/${suspect.id}/accounts`, 'admin', { platformId, handle: 'private-handle' })).account;
      await ok('PATCH', `/api/accounts/${account.id}`, 'admin', { handle: 'changed-handle' });
      const panchnama = (await ok('POST', `/api/cases/${caseId}/panchnamas`, 'examiner', {
        panchnamaNo: 'AUDIT-P1', authorityRef: 'AUTH-1', location: 'Private Place', heldAt: '2026-11-16T10:00:00Z',
      })).panchnama;
      panchnamaId = panchnama.id;
      await ok('POST', `/api/panchnamas/${panchnama.id}/witnesses`, 'examiner', { fullName: 'Private Witness', contactNo: '9876543210' });
      const session = (await ok('POST', `/api/panchnamas/${panchnama.id}/sessions`, 'examiner', {
        accountId: account.id, deviceType: 'macos', toolVersion: '1.0',
      })).session;
      sessionId = session.id;
      await ok('PATCH', `/api/sessions/${session.id}/sections/${sectionId}`, 'examiner', { status: 'skipped', reason: 'Private failure detail' });
      await ok('PATCH', `/api/sessions/${session.id}`, 'examiner', { status: 'completed' });
      const beforeRetry = await prisma.auditLog.count();
      await ok('PATCH', `/api/sessions/${session.id}`, 'examiner', { status: 'completed' });
      assert.equal(await prisma.auditLog.count(), beforeRetry, 'idempotent completion must not add events');
      const events = await prisma.auditLog.findMany({ orderBy: { id: 'asc' }, skip: start });
      assert.equal(events.length, 18);
      const captureIndex = events.findIndex(event => event.action === 'PANCHNAMA_CREATED');
      assert.ok(events.slice(0, captureIndex).every(event => event.userId === users.admin.id));
      assert.ok(events.slice(captureIndex).every(event => event.userId === users.examiner.id));
      assert.deepEqual(events.slice(-3).map(event => event.action), ['CAPTURE_STARTED', 'CAPTURE_SECTION_RECORDED', 'CAPTURE_COMPLETED']);
      const details = events.map(event => event.detail).join('');
      for (const secret of [password, passwordHash, 'Sensitive Name', '123456789012', 'private-handle', '9876543210', 'Private failure detail']) {
        assert.ok(!details.includes(secret), 'sensitive values must not enter the audit detail');
      }
    });

    await t.test('screenshot capture, report generation, and approvals are audited at the database boundary', async () => {
      const screenshot = await withAuditActor(users.examiner.id, tx => tx.screenshot.create({ data: {
        sessionId, platformSectionId: sectionId, sequenceNo: 1, filePath: '/private/evidence.png', sha256Hash: 'a'.repeat(64),
        sourceUrl: 'https://example.test/private', metadata: { privateText: 'secret-content' },
      } }));
      const report = await withAuditActor(users.examiner.id, tx => tx.report.create({ data: {
        panchnamaId, filePath: '/private/report.pdf', sha256Hash: 'b'.repeat(64), generatedBy: users.examiner.id,
      } }));
      await withAuditActor(users.reviewer.id, tx => tx.report.update({ where: { id: report.id }, data: {
        approvedBy: users.reviewer.id, approvedAt: new Date(),
      } }));
      const capture = await prisma.auditLog.findFirst({ where: { entityType: 'screenshot', entityId: screenshot.id } });
      assert.equal(capture.action, 'SCREENSHOT_CAPTURED');
      assert.equal(capture.userId, users.examiner.id);
      assert.ok(capture.detail.includes('a'.repeat(64)));
      assert.ok(!capture.detail.includes('/private/'));
      assert.ok(!capture.detail.includes('secret-content'));
      const events = await prisma.auditLog.findMany({ where: { entityType: 'report', entityId: report.id }, orderBy: { id: 'asc' } });
      assert.deepEqual(events.map(event => event.action), ['REPORT_GENERATED', 'REPORT_APPROVED']);
      assert.deepEqual(events.map(event => event.userId), [users.examiner.id, users.reviewer.id]);
    });

    await t.test('rollback, audit failure, no-op updates, and direct database writes', async () => {
      const start = await prisma.auditLog.count();
      await assert.rejects(withAuditActor(users.admin.id, async tx => {
        await tx.case.create({ data: { caseNumber: 'ROLLED-BACK', title: 'Rollback', createdBy: users.admin.id } });
        throw new Error('force rollback');
      }), /force rollback/);
      await assert.rejects(withAuditActor(2147483647, tx => tx.case.create({
        data: { caseNumber: 'AUDIT-FAIL', title: 'Audit Failure', createdBy: users.admin.id },
      })));
      assert.equal(await prisma.case.count({ where: { caseNumber: { in: ['ROLLED-BACK', 'AUDIT-FAIL'] } } }), 0);
      await withAuditActor(users.admin.id, tx => tx.user.update({ where: { id: users.admin.id }, data: { fullName: users.admin.fullName } }));
      assert.equal(await prisma.auditLog.count(), start);
      const direct = await prisma.suspect.create({ data: { fullName: 'Direct' } });
      const event = await prisma.auditLog.findFirst({ where: { entityType: 'suspect', entityId: direct.id } });
      assert.equal(event.userId, null, 'pooled connections must not retain the previous actor');
      await withAuditActor(users.admin.id, tx => tx.suspect.delete({ where: { id: direct.id } }));
      assert.equal((await prisma.auditLog.findFirst({ where: { entityType: 'suspect', entityId: direct.id }, orderBy: { id: 'desc' } })).action, 'SUSPECT_DELETED');
      assert.equal((await verify()).valid, true, 'sequence gaps after rollback are valid');
    });

    await t.test('concurrent login and record writes cannot fork the chain', async () => {
      const start = await prisma.auditLog.count();
      await Promise.all(Array.from({ length: 16 }, (_, index) => index % 2
        ? recordLogin({ success: false, reason: 'invalid_credentials' })
        : withAuditActor(users.admin.id, tx => tx.suspect.create({ data: { fullName: `Concurrent ${index}` } }))));
      assert.equal(await prisma.auditLog.count(), start + 16);
      assert.equal((await verify()).valid, true);
    });

    await t.test('multi-row writes, time zones, and supplied hashes and timestamps', async () => {
      const start = await prisma.auditLog.count();
      await withAuditActor(users.admin.id, async tx => {
        await tx.$executeRaw`SET LOCAL TIME ZONE 'Pacific/Honolulu'`;
        await tx.suspect.createMany({ data: [{ fullName: 'Multi One' }, { fullName: 'Multi Two' }] });
        await tx.auditLog.createMany({ data: [
          { action: 'TEST_EVENT', chainHash: 'f'.repeat(64), loggedAt: new Date(0), detail: 'Unicode: नमस्ते\n"quoted"' },
          { action: 'TEST_EVENT', chainHash: 'f'.repeat(64) },
        ] });
        assert.equal((await verify(tx)).valid, true);
      });
      assert.equal(await prisma.auditLog.count(), start + 4);
      const supplied = await prisma.auditLog.findFirst({ where: { action: 'TEST_EVENT' }, orderBy: { id: 'asc' } });
      assert.notEqual(supplied.chainHash, 'f'.repeat(64));
      assert.ok(supplied.loggedAt.getTime() > 0);
      assert.equal((await verify()).valid, true);
    });

    await t.test('admin authorization, bounded pagination, BigInt IDs, and checkpoint validation', async () => {
      for (const endpoint of ['/api/audit-logs', '/api/audit-logs/verify']) {
        assert.equal((await request('GET', endpoint, null)).status, 401);
        assert.equal((await request('GET', endpoint, 'examiner')).status, 403);
        assert.equal((await request('GET', endpoint, 'reviewer')).status, 403);
      }
      const page = await ok('GET', '/api/audit-logs?limit=2', 'admin');
      assert.equal(page.logs.length, 2);
      assert.equal(typeof page.logs[0].id, 'string');
      const next = await ok('GET', `/api/audit-logs?limit=2&after=${page.nextCursor}`, 'admin');
      assert.ok(BigInt(next.logs[0].id) > BigInt(page.logs[1].id));
      for (const query of ['limit=0', 'limit=101', 'after=-1', 'after=9223372036854775808', 'limit=1&limit=2']) {
        assert.equal((await request('GET', '/api/audit-logs?' + query)).status, 400);
      }
      const result = await ok('GET', '/api/audit-logs/verify', 'admin');
      assert.equal(result.valid, true);
      const checkpoint = `checkpointId=${result.headId}&checkpointHash=${result.headHash}`;
      assert.equal((await ok('GET', '/api/audit-logs/verify?' + checkpoint, 'admin')).checkpointMatches, true);
      assert.equal((await ok('GET', `/api/audit-logs/verify?checkpointId=${result.headId}&checkpointHash=${'f'.repeat(64)}`, 'admin')).valid, false);
      assert.equal((await request('GET', `/api/audit-logs/verify?checkpointId=${result.headId}`)).status, 400);
    });

    await t.test('audit UPDATE, DELETE and TRUNCATE are blocked', async () => {
      await assert.rejects(prisma.auditLog.updateMany({ data: { action: 'TAMPERED' } }), /append-only/);
      await assert.rejects(prisma.auditLog.deleteMany(), /append-only/);
      await assert.rejects(prisma.$executeRaw`TRUNCATE audit_logs`, /append-only/);
    });

    await t.test('verification detects privileged edits to every hashed field', async () => {
      const target = await prisma.auditLog.findFirst({ where: { action: 'CASE_CREATED' } });
      for (const change of [
        { action: 'FORGED' }, { detail: 'forged detail' }, { userId: users.reviewer.id },
        { entityType: 'forged' }, { entityId: 999 }, { loggedAt: new Date(0) },
        { chainHash: 'f'.repeat(64) }, { id: 999999n },
      ]) {
        await assert.rejects(prisma.$transaction(async tx => {
          await tx.$executeRaw`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_no_update_delete`;
          await tx.auditLog.update({ where: { id: target.id }, data: change });
          assert.equal((await verify(tx)).valid, false, Object.keys(change)[0]);
          throw new Error('rollback tampering');
        }), /rollback tampering/);
      }
      assert.equal((await verify()).valid, true);
    });

    await t.test('interior deletion is detected, and trusted checkpoints detect suffix deletion', async () => {
      const checkpoint = await verify();
      await assert.rejects(prisma.$transaction(async tx => {
        await tx.$executeRaw`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_no_update_delete`;
        const first = await tx.auditLog.findFirst({ orderBy: { id: 'asc' } });
        await tx.auditLog.delete({ where: { id: first.id } });
        assert.equal((await verify(tx)).valid, false);
        throw new Error('rollback deletion');
      }), /rollback deletion/);
      await assert.rejects(prisma.$transaction(async tx => {
        await tx.$executeRaw`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_no_update_delete`;
        await tx.auditLog.delete({ where: { id: checkpoint.head_id } });
        assert.equal((await verify(tx)).valid, true, 'a valid remaining prefix needs a trusted checkpoint');
        const [result] = await tx.$queryRaw`SELECT * FROM verify_audit_chain(${checkpoint.head_id}::bigint, ${checkpoint.head_hash}::text)`;
        assert.equal(result.valid, false);
        assert.equal(result.checkpoint_matches, false);
        throw new Error('rollback deletion');
      }), /rollback deletion/);
    });

    await t.test('preexisting unverifiable entries are reported rather than silently repaired', async () => {
      await assert.rejects(prisma.$transaction(async tx => {
        await tx.$executeRaw`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_hash_entry`;
        const legacy = await tx.auditLog.create({ data: { action: 'LEGACY_EVENT', chainHash: 'd'.repeat(64) } });
        const result = await verify(tx);
        assert.equal(result.valid, false);
        assert.equal(result.first_invalid_id, legacy.id);
        throw new Error('rollback legacy entry');
      }), /rollback legacy entry/);
    });

    await t.test('the existing database constraint verification still passes', () => {
      const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', baseUrl.toString(),
        '-f', path.join(__dirname, '../db/verify.sql')], {
        env: { ...process.env, PGOPTIONS: `-c search_path=${schema},public` }, encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, /FAIL \(/);
    });

    await t.test('local OCR, MongoDB persistence, search, failure/retry and authorization', {
      skip: !process.env.TEST_MONGO_URI && 'Set TEST_MONGO_URI to test local OCR and MongoDB.',
    }, async () => {
      const mongoose = require('mongoose');
      const fs = require('node:fs');
      const dbName = 'ocr_test_' + randomUUID().replaceAll('-', '');
      const evidenceDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ocr-evidence-'));
      const oldEvidenceDir = process.env.EVIDENCE_DIR;
      const oldExecutable = process.env.TESSERACT_PATH;
      const ParsedArtifact = require('../src/models/parsed-artifact');
      try {
        await mongoose.connect(process.env.TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 5000 });
        await ParsedArtifact.init();
        process.env.EVIDENCE_DIR = evidenceDir;
        const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/ocr-sample.png'));
        const source = await prisma.captureSession.findUnique({ where: { id: sessionId } });
        const pan = (await ok('POST', '/api/cases/' + caseId + '/panchnamas', 'examiner', {
          panchnamaNo: 'OCR-REPORT-P1', authorityRef: 'Fictional authority', location: 'Training room', heldAt: '2026-11-20T05:00:00Z',
        })).panchnama;
        const session = (await ok('POST', '/api/panchnamas/' + pan.id + '/sessions', 'examiner', {
          accountId: source.accountId, deviceType: 'macos', toolVersion: '1.0',
        })).session;
        const upload = await fetch(origin + '/api/sessions/' + session.id + '/screenshots?sectionId=' + sectionId + '&sequenceNo=1', {
          method: 'POST', headers: { Authorization: 'Bearer ' + tokens.examiner, 'Content-Type': 'image/png' }, body: bytes,
        });
        assert.equal(upload.status, 201);
        const { screenshot } = await upload.json();
        const endpoint = '/api/screenshots/' + screenshot.id;
        const before = await request('GET', endpoint + '/parsed-artifact', 'examiner');
        assert.equal(before.status, 404); assert.equal(before.body.parseStatus, 'pending');
        const parsed = await ok('POST', endpoint + '/parse', 'examiner');
        assert.equal(parsed.parseStatus, 'parsed');
        assert.match(parsed.artifact.text, /TRAINING\s+EVIDENCE\s+12345/);
        const stored = await ParsedArtifact.findOne({ screenshot_id: screenshot.id }).lean();
        assert.equal(stored.status, 'parsed'); assert.equal(stored.data.sha256Hash, screenshot.sha256Hash);
        assert.equal((await prisma.screenshot.findUnique({ where: { id: screenshot.id } })).parseStatus, 'parsed');
        await ok('POST', '/api/cases/' + caseId + '/assignments', 'admin', { userId: users.reviewer.id });
        const searchPath = '/api/cases/' + caseId + '/parsed-artifacts?q=EVIDENCE';
        const matches = await ok('GET', searchPath, 'reviewer');
        assert.equal(matches.artifacts.length, 1); assert.equal(matches.artifacts[0].screenshot_id, screenshot.id);
        assert.equal((await ok('GET', endpoint + '/parsed-artifact', 'reviewer')).artifact.text, stored.text);
        assert.equal((await request('POST', endpoint + '/parse', 'admin')).status, 403);
        assert.equal((await request('POST', endpoint + '/parse', 'reviewer')).status, 403);
        const outsider = await prisma.user.create({ data: { email: 'ocr-outsider@example.test', fullName: 'Fictional Outsider', role: 'examiner', passwordHash } });
        const jwt = require('jsonwebtoken');
        const outsiderToken = jwt.sign({}, process.env.JWT_SECRET, { subject: String(outsider.id), expiresIn: '1h' });
        for (const target of [endpoint + '/parsed-artifact', searchPath]) {
          assert.equal((await fetch(origin + target, { headers: { Authorization: 'Bearer ' + outsiderToken } })).status, 404);
        }
        await ok('POST', '/api/cases/' + caseId + '/assignments', 'admin', { userId: outsider.id });
        assert.equal((await fetch(origin + endpoint + '/parse', { method: 'POST', headers: { Authorization: 'Bearer ' + outsiderToken } })).status, 404);
        process.env.TESSERACT_PATH = path.join(evidenceDir, 'missing-tesseract');
        const failed = await request('POST', endpoint + '/parse', 'examiner');
        assert.equal(failed.status, 422); assert.equal(failed.body.parseStatus, 'failed');
        assert.equal((await prisma.screenshot.findUnique({ where: { id: screenshot.id } })).parseStatus, 'failed');
        assert.equal((await ok('GET', searchPath, 'reviewer')).artifacts.length, 0);
        const hidden = await request('GET', endpoint + '/parsed-artifact', 'reviewer');
        assert.equal(hidden.status, 404); assert.equal(hidden.body.parseStatus, 'failed');
        if (oldExecutable === undefined) delete process.env.TESSERACT_PATH; else process.env.TESSERACT_PATH = oldExecutable;
        assert.equal((await ok('POST', endpoint + '/parse', 'examiner')).parseStatus, 'parsed');
        assert.equal(await ParsedArtifact.countDocuments({ screenshot_id: screenshot.id }), 1);
        const metadata = await prisma.screenshot.findUnique({ where: { id: screenshot.id } });
        const filePath = path.join(evidenceDir, metadata.filePath);
        fs.writeFileSync(filePath, 'tampered fictional evidence');
        const integrity = await request('POST', endpoint + '/parse', 'examiner');
        assert.equal(integrity.status, 422); assert.match(integrity.body.message, /integrity check/);
        assert.equal((await ok('GET', searchPath, 'reviewer')).artifacts.length, 0);
        fs.writeFileSync(filePath, bytes);
        assert.equal((await ok('POST', endpoint + '/parse', 'examiner')).parseStatus, 'parsed');
        // A small local test executable makes overlapping requests deterministic.
        const slow = path.join(evidenceDir, 'slow-ocr');
        fs.writeFileSync(slow, '#!/usr/bin/env node\nprocess.stdin.resume();process.stdin.on("end",()=>setTimeout(()=>{process.stdout.write("TRAINING EVIDENCE 12345");},300));\n', { mode: 0o700 });
        process.env.TESSERACT_PATH = slow;
        const parallel = await Promise.all([request('POST', endpoint + '/parse', 'examiner'), request('POST', endpoint + '/parse', 'examiner')]);
        assert.deepEqual(parallel.map(result => result.status).sort(), [200, 409]);

        await ok('PATCH', '/api/sessions/' + session.id + '/sections/' + sectionId, 'examiner', { status: 'captured' });
        await ok('PATCH', '/api/sessions/' + session.id, 'examiner', { status: 'completed' });
        const reportsEndpoint = '/api/panchnamas/' + pan.id + '/reports';
        const report = (await ok('POST', reportsEndpoint, 'examiner')).report;
        const download = await fetch(origin + '/api/reports/' + report.id + '/file', {
          headers: { Authorization: 'Bearer ' + tokens.examiner },
        });
        assert.equal(download.status, 200);
        const pdf = Buffer.from(await download.arrayBuffer());
        assert.equal(createHash('sha256').update(pdf).digest('hex'), report.sha256Hash);
        // PDFKit writes text as hex strings inside compressed content streams.
        function containsText(bytes, text) {
          const streams = [...bytes.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
          return streams.some(([, stream]) => {
            try {
              return require('node:zlib').inflateSync(Buffer.from(stream, 'latin1')).toString()
                .includes(Buffer.from(text).toString('hex'));
            } catch { return false; }
          });
        }
        assert.equal(containsText(pdf, 'TRAINING'), true, 'report includes saved OCR text');
        await ParsedArtifact.updateOne({ screenshot_id: screenshot.id }, {
          $set: { text: 'MISMATCHED_OCR', 'data.sha256Hash': '0'.repeat(64) },
        });
        const mismatchReport = (await ok('POST', reportsEndpoint, 'examiner')).report;
        const mismatchPdf = fs.readFileSync(path.join(evidenceDir,
          (await prisma.report.findUnique({ where: { id: mismatchReport.id } })).filePath));
        assert.equal(containsText(mismatchPdf, 'MISMATCHED_OCR'), false, 'mismatched OCR must not enter report');
        const unchanged = fs.readFileSync(path.join(evidenceDir,
          (await prisma.report.findUnique({ where: { id: report.id } })).filePath));
        assert.deepEqual(unchanged, pdf, 'new OCR results do not rewrite old report versions');
        await mongoose.disconnect();
        assert.equal((await request('POST', reportsEndpoint, 'examiner')).status, 503);
        await mongoose.connect(process.env.TEST_MONGO_URI, { dbName, serverSelectionTimeoutMS: 5000 });
        assert.equal((await verify()).valid, true);
      } finally {
        if (oldExecutable === undefined) delete process.env.TESSERACT_PATH; else process.env.TESSERACT_PATH = oldExecutable;
        if (oldEvidenceDir === undefined) delete process.env.EVIDENCE_DIR; else process.env.EVIDENCE_DIR = oldEvidenceDir;
        if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        fs.rmSync(evidenceDir, { recursive: true, force: true });
      }
    });


    await t.test('report workflow: versions, verified PDFs, approvals, print audit and permissions', async () => {
      const fs = require('node:fs');
      const evidenceDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'report-evidence-'));
      const oldEvidenceDir = process.env.EVIDENCE_DIR;
      process.env.EVIDENCE_DIR = evidenceDir;
      try {
        const pan = (await ok('POST', '/api/cases/' + caseId + '/panchnamas', 'examiner', {
          panchnamaNo: 'REPORT-UI-P1', authorityRef: 'Fictional authority', location: 'Training room', heldAt: '2026-11-20T05:00:00Z',
        })).panchnama;
        const existing = await prisma.captureSession.findUnique({ where: { id: sessionId } });
        const session = (await ok('POST', '/api/panchnamas/' + pan.id + '/sessions', 'examiner', {
          accountId: existing.accountId, deviceType: 'macos', toolVersion: '1.0',
        })).session;
        await ok('POST', '/api/panchnamas/' + pan.id + '/witnesses', 'examiner', { fullName: 'Fictional Report Witness' });
        const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/ocr-sample.png'));
        const upload = await fetch(origin + '/api/sessions/' + session.id + '/screenshots?sectionId=' + sectionId + '&sequenceNo=1', {
          method: 'POST', headers: { Authorization: 'Bearer ' + tokens.examiner, 'Content-Type': 'image/png' }, body: bytes,
        });
        assert.equal(upload.status, 201);
        const endpoint = '/api/panchnamas/' + pan.id + '/reports';
        assert.deepEqual((await ok('GET', endpoint, 'admin')).reports, []);
        assert.equal((await request('POST', endpoint, 'examiner')).status, 409, 'open sessions block generation');
        await ok('PATCH', '/api/sessions/' + session.id + '/sections/' + sectionId, 'examiner', { status: 'captured' });
        await ok('PATCH', '/api/sessions/' + session.id, 'examiner', { status: 'completed' });
        const first = (await ok('POST', endpoint, 'examiner')).report;
        const second = (await ok('POST', endpoint, 'admin')).report;
        assert.equal(first.versionNo, 1); assert.equal(second.versionNo, 2);
        assert.equal(first.approvedBy, null); assert.ok(!('filePath' in first));
        assert.deepEqual((await ok('GET', endpoint, 'admin')).reports.map(report => report.versionNo), [2, 1]);
        if (!await prisma.caseAssignment.findUnique({ where: { caseId_userId: { caseId, userId: users.reviewer.id } } })) {
          await ok('POST', '/api/cases/' + caseId + '/assignments', 'admin', { userId: users.reviewer.id });
        }
        const fileEndpoint = '/api/reports/' + first.id + '/file';
        const fileResponse = await fetch(origin + fileEndpoint, { headers: { Authorization: 'Bearer ' + tokens.reviewer } });
        assert.equal(fileResponse.status, 200);
        const pdf = Buffer.from(await fileResponse.arrayBuffer());
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        assert.equal(createHash('sha256').update(pdf).digest('hex'), first.sha256Hash);
        assert.equal((await request('POST', endpoint, 'reviewer')).status, 403);
        assert.equal((await request('POST', '/api/reports/' + first.id + '/approve', 'examiner')).status, 403);
        assert.equal((await request('POST', '/api/reports/' + second.id + '/approve', 'admin')).status, 403, 'authors cannot approve their own report');
        const printCount = await prisma.auditLog.count({ where: { action: 'REPORT_PRINT_REQUESTED', entityId: first.id } });
        const draftPrint = await request('POST', '/api/reports/' + first.id + '/print-requests', 'examiner');
        assert.equal(draftPrint.status, 409); assert.match(draftPrint.body.message, /Approve this report/);
        assert.equal(await prisma.auditLog.count({ where: { action: 'REPORT_PRINT_REQUESTED', entityId: first.id } }), printCount);
        const approved = (await ok('POST', '/api/reports/' + first.id + '/approve', 'reviewer')).report;
        assert.equal(approved.approvedBy, users.reviewer.id); assert.ok(approved.approvedAt);
        assert.equal(approved.sha256Hash, first.sha256Hash);
        const approvedAgain = (await ok('POST', '/api/reports/' + first.id + '/approve', 'reviewer')).report;
        assert.equal(approvedAgain.approvedAt, approved.approvedAt);
        assert.equal((await request('POST', '/api/reports/' + first.id + '/approve', 'admin')).status, 409);
        const print = await ok('POST', '/api/reports/' + first.id + '/print-requests', 'examiner');
        assert.match(print.auditLogId, /^[1-9][0-9]*$/);
        const event = await prisma.auditLog.findUnique({ where: { id: BigInt(print.auditLogId) } });
        assert.equal(event.action, 'REPORT_PRINT_REQUESTED'); assert.equal(event.entityId, first.id);
        const outsider = await prisma.user.create({ data: { email: 'report-outsider@example.test', fullName: 'Fictional Other Reviewer', role: 'reviewer', passwordHash } });
        const token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(outsider.id), expiresIn: '1h' });
        const headers = { Authorization: 'Bearer ' + token };
        assert.equal((await fetch(origin + endpoint, { headers })).status, 404);
        assert.equal((await fetch(origin + fileEndpoint, { headers })).status, 404);
        assert.equal((await fetch(origin + '/api/reports/' + first.id + '/approve', { method: 'POST', headers })).status, 404);
        assert.equal((await fetch(origin + '/api/reports/' + first.id + '/print-requests', { method: 'POST', headers })).status, 404);
        assert.equal((await fetch(origin + fileEndpoint)).status, 401);
        const stored = await prisma.report.findUnique({ where: { id: first.id } });
        const absolutePath = path.join(evidenceDir, stored.filePath);
        fs.writeFileSync(absolutePath, 'tampered fictional PDF');
        const corrupted = await request('GET', fileEndpoint, 'reviewer');
        assert.equal(corrupted.status, 409); assert.match(corrupted.body.message, /integrity check/);
        fs.writeFileSync(absolutePath, pdf);
        fs.renameSync(absolutePath, absolutePath + '.backup');
        assert.equal((await request('GET', fileEndpoint, 'reviewer')).status, 404);
        fs.renameSync(absolutePath + '.backup', absolutePath);
        assert.equal((await verify()).valid, true);
      } finally {
        if (oldEvidenceDir === undefined) delete process.env.EVIDENCE_DIR; else process.env.EVIDENCE_DIR = oldEvidenceDir;
        fs.rmSync(evidenceDir, { recursive: true, force: true });
      }
    });


    await t.test('session workflow checks: pending sections, section-specific screenshots and failure paths', async () => {
      const fs = require('node:fs');
      const evidenceDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'workflow-evidence-'));
      const oldEvidenceDir = process.env.EVIDENCE_DIR;
      process.env.EVIDENCE_DIR = evidenceDir;
      try {
        const source = await prisma.captureSession.findUnique({ where: { id: sessionId }, include: { account: true } });
        const platform = await withAuditActor(users.admin.id, tx => tx.platform.create({
          data: { name: 'workflow_fixture', sections: { create: [{ sectionName: 'posts' }, { sectionName: 'messages' }] } },
          include: { sections: { orderBy: { id: 'asc' } } },
        }));
        const account = (await ok('POST', '/api/suspects/' + source.account.suspectId + '/accounts', 'admin', {
          platformId: platform.id, handle: 'fictional_workflow_account',
        })).account;
        async function start(accountId = account.id) {
          return (await ok('POST', '/api/panchnamas/' + panchnamaId + '/sessions', 'examiner', {
            accountId, deviceType: 'macos', toolVersion: '1.0',
          })).session;
        }
        const [posts, messages] = platform.sections;
        const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/ocr-sample.png'));
        async function upload(session, section) {
          const response = await fetch(origin + '/api/sessions/' + session.id + '/screenshots?sectionId=' + section.id + '&sequenceNo=1', {
            method: 'POST', headers: { Authorization: 'Bearer ' + tokens.examiner, 'Content-Type': 'image/png' }, body: bytes,
          });
          assert.equal(response.status, 201);
        }
        const session = await start();
        const endpoint = '/api/sessions/' + session.id;
        const baseline = await prisma.auditLog.count();
        assert.equal((await request('PATCH', endpoint, 'examiner', { status: 'completed' })).status, 409);
        const noImage = await request('PATCH', endpoint + '/sections/' + posts.id, 'examiner', { status: 'captured' });
        assert.equal(noImage.status, 409); assert.match(noImage.body.message, /Upload a screenshot/);
        assert.equal(await prisma.captureSectionOutcome.count({ where: { sessionId: session.id } }), 0);
        assert.equal(await prisma.auditLog.count(), baseline, 'rejections must not create successful mutation events');
        assert.equal((await ok('GET', endpoint, 'examiner')).session.endedAt, null);
        await upload(session, posts);
        assert.equal((await request('PATCH', endpoint, 'examiner', { status: 'completed' })).status, 409, 'a screenshot alone does not save a section outcome');
        await ok('PATCH', endpoint + '/sections/' + posts.id, 'examiner', { status: 'captured' });
        assert.equal((await request('PATCH', endpoint, 'examiner', { status: 'completed' })).status, 409, 'the second section is still pending');
        assert.equal((await request('PATCH', endpoint + '/sections/' + messages.id, 'examiner', { status: 'captured' })).status, 409, 'a screenshot from another section does not count');
        assert.equal((await request('PATCH', endpoint + '/sections/' + messages.id, 'examiner', { status: 'skipped', reason: ' ' })).status, 400);
        await ok('PATCH', endpoint + '/sections/' + messages.id, 'examiner', { status: 'skipped', reason: 'Fictional unavailable section' });
        const completed = (await ok('PATCH', endpoint, 'examiner', { status: 'completed' })).session;
        assert.ok(completed.endedAt); assert.equal(completed.status, 'completed');
        const beforeRepeat = await prisma.auditLog.count();
        await ok('PATCH', endpoint, 'examiner', { status: 'completed' });
        assert.equal(await prisma.auditLog.count(), beforeRepeat);
        assert.equal((await request('PATCH', endpoint + '/sections/' + posts.id, 'examiner', { status: 'skipped', reason: 'Late' })).status, 409);
        const failed = await start();
        assert.equal((await ok('PATCH', '/api/sessions/' + failed.id, 'examiner', { status: 'failed' })).session.status, 'failed', 'failed sessions may retain pending sections');
        const legacy = await start();
        await withAuditActor(users.examiner.id, tx => tx.captureSectionOutcome.createMany({ data: [
          { sessionId: legacy.id, platformSectionId: posts.id, status: 'captured' },
          { sessionId: legacy.id, platformSectionId: messages.id, status: 'skipped', reason: 'Fictional reason' },
        ] }));
        const legacyResult = await request('PATCH', '/api/sessions/' + legacy.id, 'examiner', { status: 'completed' });
        assert.equal(legacyResult.status, 409); assert.match(legacyResult.body.message, /screenshot for every section/);
        await upload(legacy, posts);
        await ok('PATCH', '/api/sessions/' + legacy.id, 'examiner', { status: 'completed' });
        const race = await start();
        const racePath = '/api/sessions/' + race.id;
        const attempts = await Promise.all([
          request('PATCH', racePath, 'examiner', { status: 'completed' }),
          request('PATCH', racePath + '/sections/' + posts.id, 'examiner', { status: 'skipped', reason: 'Fictional race fixture' }),
          request('PATCH', racePath + '/sections/' + messages.id, 'examiner', { status: 'failed', reason: 'Fictional race fixture' }),
        ]);
        assert.ok([200, 409].includes(attempts[0].status));
        assert.equal(attempts[1].status, 200); assert.equal(attempts[2].status, 200);
        assert.equal(await prisma.captureSectionOutcome.count({ where: { sessionId: race.id } }), 2);
        await ok('PATCH', racePath, 'examiner', { status: 'completed' });
        const emptyPlatform = await withAuditActor(users.admin.id, tx => tx.platform.create({ data: { name: 'workflow_empty_fixture' } }));
        const emptyAccount = (await ok('POST', '/api/suspects/' + source.account.suspectId + '/accounts', 'admin', { platformId: emptyPlatform.id, handle: 'no_sections' })).account;
        const empty = await start(emptyAccount.id);
        assert.equal((await request('PATCH', '/api/sessions/' + empty.id, 'examiner', { status: 'completed' })).status, 409);
        assert.equal((await verify()).valid, true);
      } finally {
        if (oldEvidenceDir === undefined) delete process.env.EVIDENCE_DIR; else process.env.EVIDENCE_DIR = oldEvidenceDir;
        fs.rmSync(evidenceDir, { recursive: true, force: true });
      }
    });

  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
    await setup.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await setup.$disconnect();
  }
});
