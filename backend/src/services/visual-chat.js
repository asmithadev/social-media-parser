// OCR word coordinates are evidence of text placement, not sender identity.
function parseVisualChat(tsv, region, incomingSide) {
  const rows = tsv.trim().split(/\r?\n/).map(line => line.split('\t'));
  if (rows[0]?.[0] !== 'level') throw new Error('Invalid OCR coordinate output.');
  const page = rows.find(row => row[0] === '1');
  const width = Number(page?.[8]), height = Number(page?.[9]);
  if (!(width > 0 && height > 0)) throw new Error('OCR image dimensions are missing.');
  const area = { x: region.x * width, y: region.y * height, width: region.width * width, height: region.height * height };
  const lines = new Map();
  for (const row of rows) {
    const text = row.slice(11).join('\t').trim();
    const [x, y, w, h, confidence] = row.slice(6, 11).map(Number);
    if (row[0] !== '5' || !text || !Number.isFinite(confidence) || confidence < 40 || ![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    if (x < area.x || y < area.y || x + w > area.x + area.width || y + h > area.y + area.height) continue;
    const key = row.slice(1, 5).join(':');
    let line = lines.get(key);
    if (!line) { line = { text: '', x, y, width: w, height: h }; lines.set(key, line); }
    const right = Math.max(line.x + line.width, x + w), bottom = Math.max(line.y + line.height, y + h);
    line.x = Math.min(line.x, x); line.y = Math.min(line.y, y);
    line.width = right - line.x; line.height = bottom - line.y;
    line.text += (line.text ? ' ' : '') + text;
  }
  const candidates = [...lines.values()].sort((a, b) => a.y - b.y || a.x - b.x).map(line => {
    const leftGap = line.x - area.x, rightGap = area.x + area.width - line.x - line.width;
    const side = Math.abs(leftGap - rightGap) < area.width * 0.15 ? 'unknown' : leftGap < rightGap ? 'left' : 'right';
    return { ...line, side, direction: side === 'unknown' ? 'unknown' : side === incomingSide ? 'incoming' : 'outgoing' };
  });
  return { method: 'ocr-position-v1', incomingSide, region, imageWidth: width, imageHeight: height, candidates };
}

module.exports = parseVisualChat;
