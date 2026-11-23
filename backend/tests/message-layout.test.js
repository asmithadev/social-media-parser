const { test } = require('node:test');
const assert = require('node:assert/strict');
const parseEvidence = require('../src/services/parse-evidence');

test('WhatsApp timestamp headers keep multiline messages and separate senders', () => {
  const text = '[22/11/2026, 10:30 AM] Alice: First line\nsecond line\n[22/11/2026, 10:31 AM] Bob: Reply\nDelivered\nType a message';
  const result = parseEvidence(text, { platform: 'whatsapp', section: 'messages' });
  assert.equal(result.parserVersion, 'message-layout-v1');
  assert.deepEqual(result.messages, [
    { sender: 'Alice', displayedDate: '22/11/2026', displayedTime: '10:30 AM', text: 'First line\nsecond line',
      lineNumber: 1, endLineNumber: 2, layout: 'whatsapp-header' },
    { sender: 'Bob', displayedDate: '22/11/2026', displayedTime: '10:31 AM', text: 'Reply',
      lineNumber: 3, endLineNumber: 3, layout: 'whatsapp-header' },
  ]);
});

test('Telegram headers support dotted dates without converting ambiguous dates', () => {
  const result = parseEvidence('Alice, [22.11.2026 10:30]\nFirst line\nSecond line\nBob, [22.11.2026 10:31]\nReply',
    { platform: 'telegram', section: 'messages' });
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].sender, 'Alice');
  assert.equal(result.messages[0].text, 'First line\nSecond line');
  assert.equal(result.messages[0].displayedDate, '22.11.2026');
  assert.deepEqual(result.dates, ['22.11.2026']);
});

test('explicit sender/timestamp blocks work on seeded chat platforms', () => {
  for (const platform of ['instagram', 'facebook', 'twitter', 'whatsapp', 'telegram']) {
    const result = parseEvidence('@sample_user\n22 November 2026, 10:30\nFirst line\nSecond line\n\nSeen',
      { platform, section: 'messages' });
    assert.equal(result.messages[0].sender, '@sample_user');
    assert.equal(result.messages[0].text, 'First line\nSecond line');
    assert.equal(result.messages[0].lineNumber, 1);
    assert.equal(result.messages[0].endLineNumber, 4);
  }
});

test('unsupported platforms, non-message sections and bare timestamps do not invent associations', () => {
  const text = 'Alice\n22 November 2026, 10:30\nA message';
  assert.equal(parseEvidence(text, { platform: 'unknown', section: 'messages' }).messages.length, 0);
  assert.equal(parseEvidence(text, { platform: 'instagram', section: 'posts' }).messages.length, 0);
  assert.equal(parseEvidence('Alice\n10:30\nA message', { platform: 'instagram', section: 'messages' }).messages.length, 0);
});

test('blank lines and standalone date/time boundaries stop multiline grouping; generic labels remain usable', () => {
  const result = parseEvidence('Alice, [22.11.2026 10:30]\nFirst message\n\nToolbar\nMessage: Explicit generic text\n23.11.2026\nUnassigned text',
    { platform: 'telegram', section: 'messages' });
  assert.equal(result.messages[0].text, 'First message');
  assert.equal(result.messages[1].text, 'Explicit generic text');
  assert.equal(result.messages[1].sender, undefined);
});
