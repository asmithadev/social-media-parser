const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { chromium } = require('playwright');
const { createApi, captureSection } = require('./api');

async function main() {
  // Hide the application's password while typing. It is never saved to a file.
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  } });
  const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
  let browser;
  try {
    console.log('macOS capture - create an open macOS session in the app first.');
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
    if (user.role !== 'examiner') throw new Error('Sign in with the session examiner account.');
    const sessionId = Number(await terminal.question('Capture session ID: '));
    if (!Number.isSafeInteger(sessionId) || sessionId < 1) throw new Error('Enter a valid session ID.');
    const { session } = await api('/sessions/' + sessionId);
    if (session.status !== 'open' || session.deviceType !== 'macos') throw new Error('Choose an open macOS session.');
    const { account } = await api('/accounts/' + session.accountId);
    console.log('Target account: ' + account.handle);
    const address = (await terminal.question('Platform URL' + (account.profileUrl ? ' (Enter for registered profile)' : '') + ': ')).trim()
      || account.profileUrl;
    const url = new URL(address);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enter a valid platform web URL.');

    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    console.log('Sign in directly in the browser. Navigate in the original tab to each section.');
    console.log('Only the visible page is captured. Scroll and capture again for more evidence.');
    while (!page.isClosed()) {
      try {
        const { sections } = await api('/sessions/' + sessionId + '/sections');
        for (const section of sections) console.log(section.id + ': ' + section.sectionName + ' [' + section.status + ']');
        const choice = (await terminal.question('Section ID, "finish", or "quit": ')).trim();
        if (choice === 'quit') break;
        if (choice === 'finish') {
          await api('/sessions/' + sessionId, 'PATCH', { status: 'completed' });
          console.log('Session completed. Continue with OCR and reports in the app.');
          break;
        }
        const section = sections.find(row => row.id === Number(choice));
        if (!section) { console.log('Choose a listed section ID.'); continue; }
        const action = (await terminal.question('Enter to capture, or type "skipped" / "failed": ')).trim();
        if (action === 'skipped' || action === 'failed') {
          const reason = (await terminal.question('Reason: ')).trim();
          if (!reason) { console.log('A reason is required.'); continue; }
          await api('/sessions/' + sessionId + '/sections/' + section.id, 'PATCH', { status: action, reason });
        } else if (action === '') {
          const screenshot = await captureSection(api, page, sessionId, section.id);
          console.log('Uploaded screenshot #' + screenshot.id + ', sequence ' + screenshot.sequenceNo + '.');
        } else console.log('Unknown action.');
      } catch (error) {
        console.log('Could not complete the action: ' + error.message);
        console.log('Check the screenshot list in the app before retrying an upload.');
      }
    }
  } finally {
    terminal.close();
    if (browser) await browser.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
