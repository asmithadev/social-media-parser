const { createHash } = require('node:crypto');
const { readEvidenceBytes } = require('../services/evidence-storage');

async function readEvidence(filePath, expectedHash) {
  const stored = await readEvidenceBytes(filePath);
  if (!stored.bytes) return stored;
  const { bytes } = stored;
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
    return { status: 409, message: 'Evidence file failed its integrity check.' };
  }
  return { bytes };
}

module.exports = readEvidence;
