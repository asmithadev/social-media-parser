const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const { createApi, captureSection } = require('./api');

test('capture a fictional browser page and upload it to the correct section', async t => {
  let uploadFails = false;
  let outcomeFails = false;
  let wrongHash = false;
  const uploads = [];
  let outcomes = 0;
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/fixture')) {
      assert.equal(req.headers.authorization, undefined, 'app token stays out of browser requests');
      res.setHeader('Content-Type', 'text/html');
      return res.end('<h1>Fictional training evidence</h1><p>Sample message 12345</p>');
    }
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== 'Bearer fictional-token') {
      res.statusCode = 401;
      return res.end(JSON.stringify({ message: 'Sign in again.' }));
    }
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.pathname.startsWith('/api/sessions/7/'), true);
    if (req.method === 'GET') {
      return res.end(JSON.stringify({ screenshots: [
        { platformSectionId: 3, sequenceNo: 5 }, { platformSectionId: 9, sequenceNo: 20 },
      ] }));
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    if (req.method === 'POST') {
      if (uploadFails) { res.statusCode = 409; return res.end(JSON.stringify({ message: 'Session has already ended.' })); }
      assert.equal(req.headers['content-type'], 'image/png');
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(url.searchParams.get('sectionId'), '3');
      assert.equal(url.searchParams.get('sequenceNo'), '6');
      assert.equal(new URL(url.searchParams.get('sourceUrl')).search, '');
      assert.equal(new URL(url.searchParams.get('sourceUrl')).hash, '');
      uploads.push(bytes);
      return res.end(JSON.stringify({ screenshot: { id: 42, sequenceNo: 6,
        sha256Hash: wrongHash ? '0'.repeat(64) : createHash('sha256').update(bytes).digest('hex') } }));
    }
    assert.equal(url.pathname, '/api/sessions/7/sections/3');
    assert.deepEqual(JSON.parse(bytes), { status: 'captured' });
    if (outcomeFails) { res.statusCode = 409; return res.end(JSON.stringify({ message: 'Session has already ended.' })); }
    outcomes++;
    res.end(JSON.stringify({ outcome: { status: 'captured' } }));
  });
  let browser;
  try {
    server.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const api = createApi(origin + '/api', 'fictional-token');
    browser = await chromium.launch({ headless: true, channel: 'chromium' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(origin + '/fixture?token=not-evidence#fragment');

    await t.test('uploads a real PNG, uses the next section sequence and records the outcome', async () => {
      assert.equal((await captureSection(api, page, 7, 3)).id, 42);
      assert.equal(uploads.length, 1);
      assert.equal(outcomes, 1);
    });
    await t.test('rejected uploads never mark a section captured', async () => {
      uploadFails = true;
      await assert.rejects(captureSection(api, page, 7, 3), /already ended/);
      assert.equal(outcomes, 1);
      uploadFails = false;
    });
    await t.test('a saved screenshot is identified when the outcome update fails', async () => {
      outcomeFails = true;
      await assert.rejects(captureSection(api, page, 7, 3), /#42 was uploaded/);
      assert.equal(outcomes, 1);
      outcomeFails = false;
    });
    await t.test('hash mismatches and expired tokens stop capture', async () => {
      wrongHash = true;
      await assert.rejects(captureSection(api, page, 7, 3), /hash does not match/);
      assert.equal(outcomes, 1);
      await assert.rejects(captureSection(createApi(origin + '/api', 'expired'), page, 7, 3), /Sign in again/);
      assert.throws(() => createApi('http://example.com/api'), /HTTPS/);
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
