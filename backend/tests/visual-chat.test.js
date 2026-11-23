const { test } = require('node:test');
const assert = require('node:assert/strict');
const parseVisual = require('../src/services/visual-chat');

const tsv = [
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
  '1\t1\t0\t0\t0\t0\t0\t0\t1000\t1000\t-1\t',
  '5\t1\t1\t1\t1\t1\t50\t200\t100\t30\t95\tHello',
  '5\t1\t1\t1\t1\t2\t160\t200\t100\t30\t95\tthere',
  '5\t1\t2\t1\t1\t1\t750\t300\t200\t30\t95\tReply',
  '5\t1\t3\t1\t1\t1\t400\t400\t200\t30\t95\tCentered',
  '5\t1\t4\t1\t1\t1\t100\t30\t200\t30\t95\tHeader',
  '5\t1\t5\t1\t1\t1\t50\t500\t100\t30\t10\tNoise',
].join('\n');
const region = { x: 0, y: 0.1, width: 1, height: 0.7 };

test('use selected chat area, merge words into text lines and label positional direction candidates', () => {
  const result = parseVisual(tsv, region, 'left');
  assert.equal(result.imageWidth, 1000);
  assert.deepEqual(result.candidates.map(line => line.direction), ['incoming', 'outgoing', 'unknown']);
  assert.equal(result.candidates[0].text, 'Hello there');
  assert.equal(result.candidates[0].width, 210);
  assert.equal(result.candidates[1].x, 750);
});
test('support opposite incoming side and preserve uncertain centered text', () => {
  assert.deepEqual(parseVisual(tsv, region, 'right').candidates.map(line => line.direction), ['outgoing', 'incoming', 'unknown']);
});
test('empty chat area returns no candidates; malformed coordinate output fails', () => {
  assert.equal(parseVisual(tsv, { x: 0, y: 0.8, width: 1, height: 0.1 }, 'left').candidates.length, 0);
  assert.throws(() => parseVisual('plain OCR text', region, 'left'), /coordinate/);
  assert.throws(() => parseVisual('level\tpage_num', region, 'left'), /dimensions/);
});
