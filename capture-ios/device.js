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

async function gesture(udid, action, coordinates) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{7,79}$/.test(udid)) throw new Error('Enter the connected iPhone UDID.');
  const count = action === 'tap' ? 2 : action === 'drag' ? 4 : 0;
  if (!count || coordinates.length !== count || !coordinates.every(value => Number.isInteger(value) && value >= 0 && value <= 65535)) {
    throw new Error('Use tap/drag coordinates from 0 to 65535.');
  }
  try {
    await run(process.env.IOS_DEVICE_TOOL || 'pymobiledevice3',
      ['developer', 'core-device', 'universal-hid-service', action, '--udid', udid, '--', ...coordinates.map(String)],
      { timeout: 60000, maxBuffer: 1024 * 1024 });
  } catch {
    throw new Error('iPhone navigation failed. Check HID service support, pairing and tunnel setup.');
  }
}

module.exports.gesture = gesture;
