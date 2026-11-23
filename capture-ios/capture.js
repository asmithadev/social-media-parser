const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { createApi } = require('../capture-macos/api');
const { captureSection } = require('./device');
const { runPlan, validatePlan } = require('./auto-capture');

async function main() {
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  } });
  const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
  try {
    const baseUrl = process.env.CAPTURE_API_URL || 'http://localhost:3000/api';
    const login = createApi(baseUrl);
    const email = (await terminal.question('Examiner app email: ')).trim();
    process.stdout.write('Examiner app password: ');
    hidden = true;
    const password = await terminal.question('');
    hidden = false;
    process.stdout.write('\n');
    const { accessToken } = await login('/auth/login', 'POST', { email, password });
    const api = createApi(baseUrl, accessToken);
    const { user } = await api('/auth/me');
    if (user.role !== 'examiner') throw new Error('Use the session examiner account.');
    const sessionId = Number(await terminal.question('Open iOS session ID: '));
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) throw new Error('Enter a valid session ID.');
    const { session } = await api('/sessions/' + sessionId);
    if (session.deviceType !== 'ios' || session.status !== 'open') throw new Error('Choose an open iOS session.');
    const { account } = await api('/accounts/' + session.accountId);
    console.log('Target account: ' + account.handle);
    const udid = (await terminal.question('Connected iPhone UDID: ')).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{7,79}$/.test(udid)) throw new Error('Enter a valid iPhone UDID.');
    console.log('Sign in directly in the platform app on the iPhone. Navigate to the intended evidence before capturing.');
    while (true) {
      try {
        const { sections } = await api('/sessions/' + sessionId + '/sections');
        for (const section of sections) console.log(section.id + ': ' + section.sectionName + ' [' + section.status + ']');
        const choice = (await terminal.question('Section ID, "auto", "finish", or "quit": ')).trim();
        if (choice === 'quit') break;
        if (choice === 'auto') {
          const plan = [];
          console.log('Open the platform on the phone first. Tap coordinates use 0-65535 across the screen.');
          console.log('Tap paths run sequentially from the previous screen. Keep orientation fixed.');
          while (true) {
            const id = (await terminal.question('Section ID (blank to end plan): ')).trim();
            if (!id) break;
            const points = (await terminal.question('Navigation taps x,y;x,y (blank for current screen): ')).trim();
            const taps = points ? points.split(';').map(point => point.split(',').map(value => Number(value.trim()))) : [];
            const screens = Number(await terminal.question('Screens (1-10): '));
            const swipe = (await terminal.question('Finger swipe direction up/down (Enter for up): ')).trim() || 'up';
            plan.push({ sectionId: Number(id), taps, screens, swipe });
            validatePlan(plan, sections);
          }
          validatePlan(plan, sections);
          if ((await terminal.question('Type "start" when the phone is positioned at the start of this plan: ')).trim() !== 'start') continue;
          await runPlan(api, udid, sessionId, plan, { onProgress: console.log });
          console.log('Review captures before using finish.');
          continue;
        }
        if (choice === 'finish') {
          await api('/sessions/' + sessionId, 'PATCH', { status: 'completed' });
          console.log('Session completed. Review evidence and run OCR in the app.');
          break;
        }
        const section = sections.find(row => row.id === Number(choice));
        if (!section) { console.log('Choose a listed section ID.'); continue; }
        const action = (await terminal.question('Enter to capture the iPhone screen, or "skipped" / "failed": ')).trim();
        if (action === 'skipped' || action === 'failed') {
          const reason = (await terminal.question('Reason: ')).trim();
          if (!reason) { console.log('A reason is required.'); continue; }
          await api('/sessions/' + sessionId + '/sections/' + section.id, 'PATCH', { status: action, reason });
        } else if (action === '') {
          const screenshot = await captureSection(api, udid, sessionId, section.id);
          console.log('Uploaded screenshot #' + screenshot.id + ', sequence ' + screenshot.sequenceNo + '.');
        } else console.log('Unknown action.');
      } catch (error) {
        console.log(error.message);
        console.log('Review the screenshot list before retrying; an upload may already have been saved.');
      }
    }
  } finally { terminal.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
