// Label-based candidates. Never interpret a count or a navigation label as a person.
function parseSection(text, section) {
  const lines = text.split(/\r?\n/);
  const profileFields = [], people = [], posts = [];
  if (section === 'account_info') {
    lines.forEach((line, index) => {
      const match = line.match(/^\s*(name|full name|username|handle|bio|about|email|phone|website|location|joined|birthday)\s*:\s*(\S.*)$/i);
      if (match) profileFields.push({ field: match[1].toLowerCase(), value: match[2].trim(), lineNumber: index + 1 });
    });
  }
  if (['friends', 'followers', 'following'].includes(section)) {
    lines.forEach((line, index) => {
      const match = line.trim().match(/^(?:(.{1,100}?)\s+)?(@[A-Za-z0-9_][A-Za-z0-9_.]{0,29})$/);
      if (match) people.push({ displayName: match[1]?.trim() || null, handle: match[2], relationship: section, lineNumber: index + 1 });
    });
  }
  if (['posts', 'timeline'].includes(section)) {
    let post;
    const finish = () => { if (post?.text.trim()) posts.push(post); post = null; };
    lines.forEach((line, index) => {
      const start = line.match(/^\s*(?:post|tweet|caption)\s*:\s*(.*)$/i);
      const metadata = line.match(/^\s*(author|date|posted)\s*:\s*(\S.*)$/i);
      if (start) {
        finish(); post = { text: start[1].trim(), lineNumber: index + 1, endLineNumber: index + 1 };
      } else if (!line.trim() || /^(?:like|comment|share|repost|reply)$/i.test(line.trim())) finish();
      else if (post && metadata) {
        if (metadata[1].toLowerCase() === 'author') post.author = metadata[2].trim();
        else post.displayedDate = metadata[2].trim();
        post.endLineNumber = index + 1;
      } else if (post) {
        post.text += (post.text ? '\n' : '') + line.trim(); post.endLineNumber = index + 1;
      }
    });
    finish();
  }
  return { profileFields, people, posts };
}

module.exports = parseSection;
