const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.FRONTEND_ORIGINS = 'https://evidence.example.test';
const app = require('../src/app');
const prisma = require('../src/config/db-config');

test('API hardening, CORS allowlist, live check and sanitized readiness', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const live = await fetch(base + '/health/live');
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: 'ok' });
  assert.equal(live.headers.get('x-powered-by'), null);
  assert.equal(live.headers.get('x-content-type-options'), 'nosniff');

  const allowed = await fetch(base + '/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evidence.example.test',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://evidence.example.test');
  assert.match(allowed.headers.get('access-control-allow-headers'), /authorization/i);

  const denied = await fetch(base + '/api/auth/login', {
    method: 'OPTIONS',
    headers: { Origin: 'https://untrusted.example.test', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);

  const originalQuery = prisma.$queryRaw;
  try {
    prisma.$queryRaw = async () => { throw new Error('postgresql://private-user:private-password@db/private'); };
    const readiness = await fetch(base + '/health');
    assert.equal(readiness.status, 503);
    const body = await readiness.text();
    assert.doesNotMatch(body, /private-user|private-password|postgresql:\/\//);
    assert.doesNotMatch(body, /"message"\s*:/);
    assert.match(body, /"postgres":"unavailable"/);
  } finally {
    prisma.$queryRaw = originalQuery;
  }

  const oversized = await fetch(base + '/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'x'.repeat(300 * 1024) }),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { message: 'Request body is too large.' });
});

test('login limiter allows ten attempts and rejects the next', async t => {
  const express = require('express');
  const createLoginRateLimit = require('../src/middleware/login-rate-limit');
  const limitedApp = express();
  limitedApp.post('/login', createLoginRateLimit(), (req, res) => res.sendStatus(204));
  const server = limitedApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/login`;

  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await fetch(url, { method: 'POST' })).status, 204);
  }
  const limited = await fetch(url, { method: 'POST' });
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).message, /Too many sign-in attempts/);
});
