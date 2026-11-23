const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { takeScreenshot, gesture } = require('./device');
const { uploadCapture } = require('../capture-macos/api');

function validatePlan(plan, sections) {
  if (!Array.isArray(plan) || !plan.length || plan.length > 20) throw new Error('Plan 1 to 20 sections.');
  const seen = new Set();
  for (const step of plan) {
    if (!sections.some(section => section.id === step.sectionId) || seen.has(step.sectionId)) throw new Error('Use each session section at most once.');
    seen.add(step.sectionId);
    if (!Number.isInteger(step.screens) || step.screens < 1 || step.screens > 10) throw new Error('Choose 1 to 10 screens.');
    if (!['up', 'down'].includes(step.swipe)) throw new Error('Swipe must be up or down.');
    if (!Array.isArray(step.taps) || step.taps.length > 5 || step.taps.some(point =>
      !Array.isArray(point) || point.length !== 2 || !point.every(value => Number.isInteger(value) && value >= 0 && value <= 65535))) {
      throw new Error('Use up to five tap points with integer coordinates from 0 to 65535.');
    }
  }
}

async function runPlan(api, udid, sessionId, plan, tools = {}) {
  const capture = tools.capture || takeScreenshot;
  const move = tools.gesture || gesture;
  const wait = tools.wait || (() => delay(1500));
  const { session } = await api('/sessions/' + sessionId);
  if (session.status !== 'open' || session.deviceType !== 'ios') throw new Error('Choose an open iOS session.');
  const { sections } = await api('/sessions/' + sessionId + '/sections');
  validatePlan(plan, sections);
  for (const step of plan) {
    let uploaded = 0;
    try {
      for (const point of step.taps) { await move(udid, 'tap', point); await wait(); }
      let previousHash;
      for (let index = 0; index < step.screens; index++) {
        if (index > 0) {
          const coordinates = step.swipe === 'up' ? [32768, 50000, 32768, 18000] : [32768, 18000, 32768, 50000];
          await move(udid, 'drag', coordinates);
          await wait();
        }
        const bytes = await capture(udid);
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (hash === previousHash) break;
        const { screenshots } = await api('/sessions/' + sessionId + '/screenshots');
        const screenshot = await uploadCapture(api, bytes, sessionId, step.sectionId, screenshots, undefined, false);
        uploaded++; previousHash = hash;
        tools.onProgress?.('Section ' + step.sectionId + ': uploaded #' + screenshot.id);
      }
      await api('/sessions/' + sessionId + '/sections/' + step.sectionId, 'PATCH', { status: 'captured' });
    } catch (error) {
      throw new Error('iPhone plan stopped at section ' + step.sectionId + ' after ' + uploaded + ' confirmed upload(s): ' + error.message +
        ' Review existing screenshots before retrying.');
    }
  }
}

module.exports = { runPlan, validatePlan };
