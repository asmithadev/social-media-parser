// Conservative text layouts: these rules do not infer bubble direction or account identity.
function parseMessageLayout(text, platform) {
  const lines = text.split(/\r?\n/);
  const messages = [];
  let current = null;
  const datePart = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}|\\d{1,2}\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{4})';
  const timePart = '\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?';
  const timestamp = new RegExp('^(' + datePart + ')[, ]+(' + timePart + ')$', 'i');
  const dateOnly = new RegExp('^' + datePart + '$', 'i');
  const whatsapp = new RegExp('^\\[?(' + datePart + ')[, ]+(' + timePart + ')\\]?\\s*(?:-\\s*)?([^:]{1,100}):\\s*(.*)$', 'i');
  const telegram = new RegExp('^(.{1,100}?),\\s*\\[(' + datePart + ')\\s+(' + timePart + ')\\]\\s*(.*)$', 'i');

  function finish() {
    if (current?.text.trim()) messages.push(current);
    current = null;
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    let header;
    if (platform === 'whatsapp') {
      const match = line.match(whatsapp);
      if (match) header = { sender: match[3].trim(), displayedDate: match[1], displayedTime: match[2], text: match[4] };
    } else if (platform === 'telegram') {
      const match = line.match(telegram);
      if (match) header = { sender: match[1].trim(), displayedDate: match[2], displayedTime: match[3], text: match[4] };
    }
    // A standalone sender followed immediately by a complete timestamp is
    // an explicit two-line block. Never infer a sender from a bare time.
    const nextTimestamp = lines[index + 1]?.trim().match(timestamp);
    if (!header && line && line.length <= 100 && nextTimestamp &&
        !/^(message|text|date|time|sent|seen|delivered)\s*:/i.test(line) && !dateOnly.test(line)) {
      finish();
      current = { sender: line, displayedDate: nextTimestamp[1], displayedTime: nextTimestamp[2],
        text: '', lineNumber: index + 1, endLineNumber: index + 2, layout: 'sender-timestamp-block' };
      index++;
      continue;
    }
    if (header) {
      finish();
      current = { ...header, lineNumber: index + 1, endLineNumber: index + 1, layout: platform + '-header' };
    } else if (dateOnly.test(line)) {
      finish();
    } else if (!line || /^(?:seen|delivered|read|sent|typing\.{0,3}|message|type a message|write a message)$/i.test(line)) {
      finish();
    } else if (new RegExp('^' + timePart + '$', 'i').test(line)) {
      // Standalone times/dates are preserved in raw OCR, not assigned by proximity.
      finish();
    } else if (current) {
      current.text += (current.text ? '\n' : '') + line;
      current.endLineNumber = index + 1;
    }
  }
  finish();
  return messages;
}

module.exports = parseMessageLayout;
