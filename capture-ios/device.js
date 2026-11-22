const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdtemp, chmod, readFile, rm } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { uploadCapture } = require('../capture-macos/api');
const run = promisify(execFile);

async function takeScreenshot(udid) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{7,79}$/.test(udid)) throw new Error('Enter the connected iPhone UDID.');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ios-capture-'));
  try {
    await chmod(directory, 0o700);
    const file = path.join(directory, 'screen.png');
    try {
      await run(process.env.IOS_DEVICE_TOOL || 'pymobiledevice3',
        ['developer', 'dvt', 'screenshot', '--udid', udid, file],
        { timeout: 60000, maxBuffer: 1024 * 1024 });
    } catch {
      throw new Error('iPhone capture failed. Check pymobiledevice3, USB trust, Developer Mode, disk image and tunnel setup.');
    }
    return await readFile(file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function captureSection(api, udid, sessionId, sectionId, capture = takeScreenshot) {
  const { session } = await api('/sessions/' + sessionId);
  if (session.deviceType !== 'ios' || session.status !== 'open') throw new Error('Choose an open iOS session.');
  const { screenshots } = await api('/sessions/' + sessionId + '/screenshots');
  const bytes = await capture(udid);
  // Native apps have no reliable browser URL; leave sourceUrl unset.
  return uploadCapture(api, bytes, sessionId, sectionId, screenshots);
}

module.exports = { takeScreenshot, captureSection };
