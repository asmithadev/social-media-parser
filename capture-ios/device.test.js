const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { takeScreenshot, captureSection } = require('./device');

test('device command selects a UDID, returns original PNG and removes temporary files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ios-test-'));
  const oldTool = process.env.IOS_DEVICE_TOOL;
  try {
    const fixture = path.resolve(__dirname, '../backend/tests/fixtures/ocr-sample.png');
    const tool = path.join(dir, 'device-tool');
    const record = path.join(dir, 'arguments.json');
    await fs.writeFile(tool, '#!' + process.execPath + '\n' +
      'const fs = require("node:fs"); const args = process.argv.slice(2);' +
      'fs.writeFileSync(' + JSON.stringify(record) + ', JSON.stringify(args));' +
      'fs.copyFileSync(' + JSON.stringify(fixture) + ', args.at(-1));', { mode: 0o700 });
    process.env.IOS_DEVICE_TOOL = tool;
    assert.deepEqual(await takeScreenshot('00008110-FAKEDEVICE'), await fs.readFile(fixture));
    const args = JSON.parse(await fs.readFile(record, 'utf8'));
    assert.deepEqual(args.slice(0, 5), ['developer', 'dvt', 'screenshot', '--udid', '00008110-FAKEDEVICE']);
    await assert.rejects(fs.access(path.dirname(args.at(-1))), { code: 'ENOENT' });
    process.env.IOS_DEVICE_TOOL = path.join(dir, 'missing-tool');
    await assert.rejects(takeScreenshot('00008110-FAKEDEVICE'), /iPhone capture failed/);
    await assert.rejects(takeScreenshot('--invalid'), /UDID/);
  } finally {
    if (oldTool === undefined) delete process.env.IOS_DEVICE_TOOL; else process.env.IOS_DEVICE_TOOL = oldTool;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('iOS capture uses original PNG, continues numbering and only marks successful uploads captured', async () => {
  const bytes = await fs.readFile(path.resolve(__dirname, '../backend/tests/fixtures/ocr-sample.png'));
  let status = 'open';
  let type = 'ios';
  let failUpload = false;
  let outcomeCount = 0;
  let captures = 0;
  const capture = async () => { captures++; return bytes; };
  const api = async (endpoint, method, body) => {
    if (endpoint === '/sessions/7') return { session: { status, deviceType: type } };
    if (!method) return { screenshots: [{ platformSectionId: 3, sequenceNo: 4 }] };
    if (method === 'POST') {
      if (failUpload) throw new Error('Upload rejected');
      const query = new URL(endpoint, 'http://localhost').searchParams;
      assert.equal(query.get('sequenceNo'), '5');
      assert.equal(query.get('sectionId'), '3');
      assert.equal(query.has('sourceUrl'), false);
      assert.deepEqual(body, bytes);
      return { screenshot: { id: 42, sha256Hash: createHash('sha256').update(body).digest('hex') } };
    }
    assert.equal(endpoint, '/sessions/7/sections/3');
    assert.deepEqual(body, { status: 'captured' });
    outcomeCount++;
  };
  assert.equal((await captureSection(api, 'fake-device', 7, 3, capture)).id, 42);
  failUpload = true;
  await assert.rejects(captureSection(api, 'fake-device', 7, 3, capture), /Upload rejected/);
  assert.equal(outcomeCount, 1);
  status = 'completed';
  await assert.rejects(captureSection(api, 'fake-device', 7, 3, capture), /open iOS/);
  status = 'open'; type = 'macos';
  await assert.rejects(captureSection(api, 'fake-device', 7, 3, capture), /open iOS/);
  assert.equal(captures, 2);
  status = 'open'; type = 'ios'; failUpload = false;
  await assert.rejects(captureSection(api, 'fake-device', 7, 3, async () => Buffer.from('invalid')), /PNG/);
  await assert.rejects(captureSection(api, 'fake-device', 7, 3, async () => { throw new Error('Disconnected'); }), /Disconnected/);
  assert.equal(outcomeCount, 1);
});
