const { test } = require('node:test');
const assert = require('node:assert/strict');
const parseEvidence = require('../src/services/parse-evidence');

test('extract labelled fields and retain source line numbers without guessing associations', () => {
  const text = 'Username: sample_user\r\n2026-11-22\r\nMessage: Hello from training\r\nText: Another message\r\n@sample_user';
  assert.deepEqual(parseEvidence(text), {
    parserVersion: 'basic-v1', usernames: ['@sample_user'], dates: ['2026-11-22'],
    messages: [{ lineNumber: 3, text: 'Hello from training' }, { lineNumber: 4, text: 'Another message' }],
  });
});

test('preserve ambiguous date formats and deduplicate candidates', () => {
  const result = parseEvidence('@demo @demo\n22 November 2026\n01/02/2026\n22-11-2026\n01/02/2026');
  assert.deepEqual(result.usernames, ['@demo']);
  assert.deepEqual(result.dates, ['22 November 2026', '01/02/2026', '22-11-2026']);
});

test('do not turn email addresses, arbitrary lines or empty labels into messages', () => {
  const result = parseEvidence('person@example.test\nUnlabelled conversation\nMessage:   \nUsername: invalid handle');
  assert.deepEqual(result.usernames, []);
  assert.deepEqual(result.messages, []);
  assert.deepEqual(parseEvidence('').dates, []);
});
