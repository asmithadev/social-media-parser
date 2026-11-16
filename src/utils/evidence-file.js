const { createHash } = require('node:crypto');
const { readFile, realpath } = require('node:fs/promises');
const path = require('node:path');

async function readEvidence(filePath, expectedHash) {
  let bytes;
  try {
    const root = await realpath(process.env.EVIDENCE_DIR || 'evidence');
    const target = await realpath(path.resolve(root, filePath));
    const relative = path.relative(root, target);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      return { status: 404, message: 'Evidence file not found.' };
    }
    bytes = await readFile(target);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
      return { status: 404, message: 'Evidence file not found.' };
    }
    throw error;
  }
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
    return { status: 409, message: 'Evidence file failed its integrity check.' };
  }
  return { bytes };
}

module.exports = readEvidence;
