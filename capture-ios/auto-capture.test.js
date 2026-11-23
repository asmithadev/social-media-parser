const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { runPlan, validatePlan } = require('./auto-capture');
const png = readFileSync(path.join(__dirname, '../backend/tests/fixtures/ocr-sample.png'));

test('iPhone plans tap section paths, scroll, upload screens and mark outcomes only after success', async () => {
  const uploads = [], actions = [], outcomes = [];
  let captures = 0, fail = false;
  const api = async (endpoint, method, body) => {
    if (endpoint === '/sessions/7') return { session: { deviceType: 'ios', status: 'open' } };
    if (endpoint.endsWith('/sections')) return { sections: [{ id: 1 }, { id: 2 }] };
    if (!method) return { screenshots: uploads };
    if (method === 'POST') {
      const query = new URL(endpoint, 'http://localhost').searchParams;
      const screenshot = { id: uploads.length + 1, platformSectionId: Number(query.get('sectionId')),
        sequenceNo: Number(query.get('sequenceNo')), sha256Hash: createHash('sha256').update(body).digest('hex') };
      uploads.push(screenshot); return { screenshot };
    }
    outcomes.push(endpoint);
  };
  const tools = {
    wait: async () => {},
    capture: async () => Buffer.concat([png, Buffer.from(String(captures++))]),
    gesture: async (udid, action, coords) => { if (fail) throw new Error('Phone disconnected'); actions.push({ action, coords }); },
  };
  const plan = [{ sectionId: 1, taps: [[10000, 20000]], screens: 2, swipe: 'up' },
    { sectionId: 2, taps: [[30000, 40000]], screens: 1, swipe: 'down' }];
  await runPlan(api, 'fictional-device', 7, plan, tools);
  assert.deepEqual(actions.map(row => row.action), ['tap', 'drag', 'tap']);
  assert.deepEqual(uploads.map(row => row.sequenceNo), [1, 2, 1]);
  assert.equal(outcomes.length, 2);
  fail = true;
  await assert.rejects(runPlan(api, 'fictional-device', 7, plan, tools), /disconnected/);
  assert.equal(uploads.length, 3);
  assert.equal(outcomes.length, 2);
  await runPlan(api, 'fictional-device', 7, [{ sectionId: 1, taps: [], screens: 5, swipe: 'up' }], {
    ...tools, capture: async () => png, gesture: async () => {},
  });
  assert.equal(uploads.length, 4, 'unchanged screen is not uploaded repeatedly');
  assert.throws(() => validatePlan([{ sectionId: 1, taps: [[-1, 0]], screens: 2, swipe: 'up' }], [{ id: 1 }]), /coordinates/);
});
