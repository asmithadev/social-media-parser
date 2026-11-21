const { createHash } = require('node:crypto');

function createApi(baseUrl, token = '') {
  const base = new URL(baseUrl);
  if (base.username || base.password || (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) {
    throw new Error('Use HTTPS for the API, or HTTP on localhost.');
  }
  return async function api(endpoint, method = 'GET', body) {
    const isImage = Buffer.isBuffer(body);
    const response = await fetch(baseUrl.replace(/\/$/, '') + endpoint, {
      method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body ? { 'Content-Type': isImage ? 'image/png' : 'application/json' } : {}),
      },
      body: body ? (isImage ? body : JSON.stringify(body)) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || 'API request failed (' + response.status + ').');
    if (!data) throw new Error('The API returned an invalid response.');
    return data;
  };
}

async function captureSection(api, page, sessionId, sectionId) {
  const source = new URL(page.url());
  if (!['http:', 'https:'].includes(source.protocol)) throw new Error('Open a platform web page before capturing.');
  const { screenshots } = await api('/sessions/' + sessionId + '/screenshots');
  const sequenceNo = 1 + Math.max(0, ...screenshots
    .filter(row => row.platformSectionId === sectionId).map(row => row.sequenceNo));
  const bytes = await page.screenshot({ type: 'png' });
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Screenshot exceeds the API limit of 10 MB.');
  // Query strings and fragments can contain login tokens; keep only the page path.
  const query = new URLSearchParams({ sectionId, sequenceNo, sourceUrl: source.origin + source.pathname });
  const { screenshot } = await api('/sessions/' + sessionId + '/screenshots?' + query, 'POST', bytes);
  if (screenshot.sha256Hash !== createHash('sha256').update(bytes).digest('hex')) {
    throw new Error('Uploaded screenshot hash does not match. Review the evidence in the app.');
  }
  try {
    await api('/sessions/' + sessionId + '/sections/' + sectionId, 'PATCH', { status: 'captured' });
  } catch (error) {
    throw new Error('Screenshot #' + screenshot.id + ' was uploaded, but its section result was not saved: ' + error.message +
      ' Save the result in the app; you do not need to capture it again.');
  }
  return screenshot;
}

module.exports = { createApi, captureSection };
