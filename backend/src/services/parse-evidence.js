// Basic candidates only: keep the original text and do not guess who sent a message.
function parseEvidence(text, context = {}) {
  const usernames = new Set();
  const dates = new Set();
  const messages = [];
  const lines = text.split(/\r?\n/);
  const datePattern = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\b/gi;

  lines.forEach((line, index) => {
    // Require a visible @handle or an explicit username label.
    for (const match of line.matchAll(/(?:^|[\s(])(@[A-Za-z0-9_][A-Za-z0-9_.]{0,29})(?![A-Za-z0-9_.])/g)) {
      usernames.add(match[1]);
    }
    const username = line.match(/^\s*(?:username|handle)\s*:\s*@?([A-Za-z0-9_][A-Za-z0-9_.]{0,29})\s*$/i);
    if (username) usernames.add('@' + username[1]);
    for (const match of line.matchAll(datePattern)) dates.add(match[0]);

    // Only labelled messages are recognized. Unlabelled text remains in raw OCR.
    const message = line.match(/^\s*(?:message|text)\s*:\s*(.+)$/i);
    if (message?.[1].trim()) messages.push({ lineNumber: index + 1, text: message[1].trim() });
  });

  const platform = (context.platform || '').trim().toLowerCase();
  const supported = ['whatsapp', 'telegram', 'instagram', 'facebook', 'twitter'].includes(platform);
  if (supported && context.section === 'messages') {
    const layoutMessages = require('./message-layout')(text, platform);
    if (layoutMessages.length) {
      // Keep basic labelled messages outside recognized blocks without duplicates.
      const remaining = messages.filter(message => !layoutMessages.some(block =>
        message.lineNumber >= block.lineNumber && message.lineNumber <= block.endLineNumber));
      for (const message of layoutMessages) dates.add(message.displayedDate);
      return { parserVersion: 'message-layout-v1', platform, usernames: [...usernames], dates: [...dates],
        messages: [...layoutMessages, ...remaining].sort((a, b) => a.lineNumber - b.lineNumber) };
    }
  }
  return { parserVersion: 'basic-v1', usernames: [...usernames], dates: [...dates], messages };
}

module.exports = parseEvidence;
