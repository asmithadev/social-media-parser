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
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
    await setup.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await setup.$disconnect();
  }
});
