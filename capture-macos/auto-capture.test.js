const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const { runPlan, validatePlan } = require('./auto-capture');

test('automatic navigation, scrolling, section uploads and failure handling', async t => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/login' }); return res.end(); }
    if (req.url === '/login') return res.end('<input type="password">');
    if (req.url === '/missing') { res.statusCode = 404; return res.end('Not found'); }
    const lines = Array.from({ length: 25 }, (_, i) => '<p style="height:100px;background:hsl(' + i*12 + ',60%,80%)">Fictional message ' + i + '</p>').join('');
    res.end(req.url === '/feed' ? '<div id="feed" style="height:500px;overflow:auto">' + lines + '</div>' :
      req.url === '/short' ? '<h1>Short fictional page</h1>' : lines);
  });
  let browser;
  try {
    server.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, channel: 'chromium' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let uploads, outcomes, failAt;
    function reset() { uploads = []; outcomes = []; failAt = Infinity; }
    const api = async (endpoint, method, body) => {
      if (endpoint === '/sessions/7') return { session: { status: 'open', deviceType: 'macos' } };
      if (endpoint.endsWith('/sections')) return { sections: [{ id: 1 }, { id: 2 }] };
      if (!method) return { screenshots: uploads };
      if (method === 'POST') {
        if (uploads.length === failAt) throw new Error('Upload failed');
        const params = new URL(endpoint, origin).searchParams;
        const screenshot = { id: uploads.length + 1, platformSectionId: Number(params.get('sectionId')),
          sequenceNo: Number(params.get('sequenceNo')), sha256Hash: createHash('sha256').update(body).digest('hex') };
        uploads.push(screenshot);
        return { screenshot };
      }
      assert.equal(body.status, 'captured');
      outcomes.push(endpoint);
    };
    const run = plan => runPlan(api, page, 7, plan, { waitMs: 100 });
    await t.test('visit two URLs, scroll page and nested feed, and mark each section after its uploads', async () => {
      reset();
      const summary = await run([
        { sectionId: 1, url: origin + '/posts', screens: 3 },
        { sectionId: 2, url: origin + '/feed', screens: 2, scrollSelector: '#feed' },
      ]);
      assert.deepEqual(summary, [{ sectionId: 1, uploaded: 3 }, { sectionId: 2, uploaded: 2 }]);
      assert.deepEqual(uploads.map(row => row.sequenceNo), [1, 2, 3, 1, 2]);
      assert.equal(new Set(uploads.map(row => row.sha256Hash)).size, 5);
      assert.equal(outcomes.length, 2);
      assert.ok(await page.locator('#feed').evaluate(element => element.scrollTop) > 0);
    });
    await t.test('stop at the bottom instead of repeatedly capturing an unchanged page', async () => {
      reset();
      assert.deepEqual(await run([{ sectionId: 1, url: origin + '/short', screens: 5 }]), [{ sectionId: 1, uploaded: 1 }]);
    });
    await t.test('stop on partial upload failure without marking the section or visiting the next one', async () => {
      reset(); failAt = 1;
      await assert.rejects(run([{ sectionId: 1, url: origin + '/posts', screens: 3 },
        { sectionId: 2, url: origin + '/feed', screens: 1 }]), /after 1 confirmed upload/);
      assert.equal(uploads.length, 1); assert.equal(outcomes.length, 0);
      assert.equal(new URL(page.url()).pathname, '/posts');
    });
    await t.test('reject redirects, visible login forms, missing pages and missing scroll containers', async () => {
      for (const suffix of ['/redirect', '/login', '/missing']) {
        reset();
        await assert.rejects(run([{ sectionId: 1, url: origin + suffix, screens: 1 }]));
        assert.equal(uploads.length, 0); assert.equal(outcomes.length, 0);
      }
      await assert.rejects(run([{ sectionId: 1, url: origin + '/posts', screens: 1, scrollSelector: '#absent' }]), /container/);
    });
    await t.test('validate the entire plan before capturing', async () => {
      reset();
      assert.throws(() => validatePlan([{ sectionId: 1, url: origin, screens: 11 }], [{ id: 1 }]), /1 to 10/);
      await assert.rejects(run([{ sectionId: 99, url: origin, screens: 1 }]), /valid session section/);
      await assert.rejects(run([{ sectionId: 1, url: origin, screens: 1 }, { sectionId: 1, url: origin, screens: 1 }]), /at most once/);
      assert.equal(uploads.length, 0);
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
