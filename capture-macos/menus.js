// English navigation labels only. Never click follow/unfollow or message-send buttons.
const labels = {
  posts: ['Posts', 'Tweets'], messages: ['Messages', 'Chats', 'Direct'],
  account_info: ['Profile', 'About'], friends: ['Friends'], followers: ['Followers'],
  following: ['Following'], timeline: ['Timeline'],
};

async function openSection(page, sectionName) {
  if (!labels[sectionName]) throw new Error('This section has no menu rule. Use URL-based auto capture.');
  const matches = [];
  for (const role of ['link', 'tab']) {
    for (const name of labels[sectionName]) {
      const candidates = page.getByRole(role, { name, exact: true });
      for (let index = 0; index < await candidates.count(); index++) {
        const candidate = candidates.nth(index);
        if (await candidate.isVisible()) matches.push(candidate);
      }
    }
  }
  if (matches.length !== 1) throw new Error('Menu is missing or ambiguous. Use the manual or URL-based mode.');
  const origin = new URL(page.url()).origin;
  const href = await matches[0].getAttribute('href');
  if (href && new URL(href, page.url()).origin !== origin) throw new Error('Menu points outside the current platform.');
  await matches[0].click({ timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  if (new URL(page.url()).origin !== origin) throw new Error('The menu redirected outside the platform.');
}

module.exports = { labels, openSection };
