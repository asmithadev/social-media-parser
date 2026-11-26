const orderedPlan = require('./section-order');
const { runPlan } = require('./auto-capture');

async function captureAll(api, page, sessionId, screens, onProgress = console.log) {
  if (!Number.isInteger(screens) || screens < 1 || screens > 10) throw new Error('Choose 1 to 10 screens per section.');
  const { sections } = await api('/sessions/' + sessionId + '/sections');
  const home = page.url();
  const summary = [];
  for (const step of orderedPlan(sections.map(section => ({ sectionId: section.id })), sections)) {
    const section = sections.find(section => section.id === step.sectionId);
    const { session } = await api('/sessions/' + sessionId);
    if (session.status !== 'open' || session.deviceType !== 'macos') throw new Error('The macOS session is no longer open.');
    try {
      await runPlan(api, page, sessionId, [{ ...step, menuSection: section.sectionName, menuHome: home, screens }], { onProgress });
      summary.push({ section: section.sectionName, status: 'captured' });
    } catch {
      // Preserve a previously captured outcome, including after a failed rerun.
      const current = (await api('/sessions/' + sessionId + '/sections')).sections.find(row => row.id === section.id);
      const reason = 'Automatic capture could not finish this section. Review saved images and capture it manually.';
      if (current?.status !== 'captured') {
        await api('/sessions/' + sessionId + '/sections/' + section.id, 'PATCH', { status: 'failed', reason });
      }
      summary.push({ section: section.sectionName, status: 'needs review' });
      onProgress(section.sectionName + ': needs manual review; continuing to the next section.');
    }
  }
  return summary;
}

module.exports = captureAll;
