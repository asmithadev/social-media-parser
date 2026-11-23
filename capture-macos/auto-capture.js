const { uploadCapture } = require('./api');
const { labels, openSection } = require('./menus');

function validatePlan(plan, sections) {
  if (!Array.isArray(plan) || !plan.length || plan.length > 20) throw new Error('Plan between 1 and 20 sections.');
  const seen = new Set();
  for (const step of plan) {
    if (!sections.some(section => section.id === step.sectionId) || seen.has(step.sectionId)) {
      throw new Error('Use each valid session section ID at most once.');
    }
    seen.add(step.sectionId);
    const url = new URL(step.url || step.menuHome);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Use a platform web URL without embedded credentials.');
    }
    if (step.menuSection && (!labels[step.menuSection] ||
      sections.find(section => section.id === step.sectionId)?.sectionName !== step.menuSection)) {
      throw new Error('Menu section must match the session section.');
    }
    if (!Number.isInteger(step.screens) || step.screens < 1 || step.screens > 10) {
      throw new Error('Choose 1 to 10 screens per section.');
    }
  }
}

// Scroll the document, or an explicitly chosen feed container, with 20% overlap.
async function scrollPosition(page, selector, move) {
  return page.evaluate(({ selector, move }) => {
    const element = selector ? document.querySelector(selector) : document.scrollingElement;
    if (!element) throw new Error('Scroll container was not found.');
    if (move) element.scrollTop += Math.max(1, Math.floor(element.clientHeight * 0.8));
    else element.scrollTop = 0;
    return element.scrollTop;
  }, { selector, move });
}

async function runPlan(api, page, sessionId, plan, options = {}) {
  const waitMs = options.waitMs ?? 1500;
  if (!Number.isInteger(waitMs) || waitMs < 0 || waitMs > 10000) throw new Error('Wait must be between 0 and 10000 milliseconds.');
  const { session } = await api('/sessions/' + sessionId);
  if (session.status !== 'open' || session.deviceType !== 'macos') throw new Error('Choose an open macOS session.');
  const { sections } = await api('/sessions/' + sessionId + '/sections');
  validatePlan(plan, sections);
  const progress = options.onProgress || (() => {});
  const summary = [];
  for (const step of plan) {
    let target = new URL(step.url || step.menuHome);
    let uploaded = 0;
    try {
      const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response && !response.ok()) throw new Error('The section page returned HTTP ' + response.status() + '.');
      if (step.menuSection) {
        await openSection(page, step.menuSection);
        await page.waitForTimeout(waitMs);
        target = new URL(page.url());
      }
      await scrollPosition(page, step.scrollSelector, false);
      await page.waitForTimeout(waitMs);
      let previousPosition = 0;
      for (let index = 0; index < step.screens; index++) {
        let current = new URL(page.url());
        if (current.origin !== target.origin || current.pathname !== target.pathname || current.hash !== target.hash) {
          throw new Error('The page redirected. Sign in or correct the section URL before retrying.');
        }
        const passwords = page.locator('input[type="password"]');
        for (let i = 0; i < await passwords.count(); i++) {
          if (await passwords.nth(i).isVisible()) throw new Error('A sign-in form is visible. Sign in manually before capture.');
        }
        if (index > 0) {
          await scrollPosition(page, step.scrollSelector, true);
          await page.waitForTimeout(waitMs);
          const position = await page.evaluate(selector =>
            (selector ? document.querySelector(selector) : document.scrollingElement)?.scrollTop, step.scrollSelector);
          if (position === previousPosition) {
            progress('Section ' + step.sectionId + ': no further scrolling; stopping this section.');
            break;
          }
          previousPosition = position;
        }
        current = new URL(page.url());
        if (current.origin !== target.origin || current.pathname !== target.pathname || current.hash !== target.hash) {
          throw new Error('The page redirected while scrolling. Review the section before retrying.');
        }
        const { screenshots } = await api('/sessions/' + sessionId + '/screenshots');
        const bytes = await page.screenshot({ type: 'png' });
        const screenshot = await uploadCapture(api, bytes, sessionId, step.sectionId, screenshots,
          current.origin + current.pathname, false);
        uploaded++;
        progress('Section ' + step.sectionId + ': uploaded screenshot #' + screenshot.id + '.');
      }
      await api('/sessions/' + sessionId + '/sections/' + step.sectionId, 'PATCH', { status: 'captured' });
      summary.push({ sectionId: step.sectionId, uploaded });
    } catch (error) {
      throw new Error('Automatic capture stopped at section ' + step.sectionId + ' after ' + uploaded +
        ' confirmed upload(s): ' + error.message + ' Review saved screenshots before retrying.');
    }
  }
  return summary;
}

module.exports = { validatePlan, runPlan };
