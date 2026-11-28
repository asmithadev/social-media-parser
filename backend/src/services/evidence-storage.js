const { mkdir, readFile, realpath, writeFile } = require('node:fs/promises');
const path = require('node:path');

function usesVercelBlob() {
  return process.env.VERCEL === '1' || process.env.EVIDENCE_STORAGE === 'vercel-blob';
}

function validBlobPath(filePath) {
  return typeof filePath === 'string' &&
    /^(screenshots|reports)\/[A-Za-z0-9_-]+\.(png|pdf)$/.test(filePath);
}

async function writeEvidence(filePath, bytes, contentType) {
  if (usesVercelBlob()) {
    if (!validBlobPath(filePath)) throw new Error('Invalid evidence pathname.');
    const { put } = require('@vercel/blob');
    const blob = await put(filePath, bytes, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType,
    });
    return blob.pathname;
  }

  const absolutePath = path.resolve(process.env.EVIDENCE_DIR || 'evidence', filePath);
  await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  await writeFile(absolutePath, bytes, { flag: 'wx', mode: 0o600, flush: true });
  return filePath;
}

async function readEvidenceBytes(filePath) {
  if (usesVercelBlob()) {
    if (!validBlobPath(filePath)) return { status: 404, message: 'Evidence file not found.' };
    const { get } = require('@vercel/blob');
    const blob = await get(filePath, { access: 'private' });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return { status: 404, message: 'Evidence file not found.' };
    }
    const chunks = [];
    for await (const chunk of blob.stream) chunks.push(Buffer.from(chunk));
    return { bytes: Buffer.concat(chunks) };
  }

  try {
    const root = await realpath(process.env.EVIDENCE_DIR || 'evidence');
    const target = await realpath(path.resolve(root, filePath));
    const relative = path.relative(root, target);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      return { status: 404, message: 'Evidence file not found.' };
    }
    return { bytes: await readFile(target) };
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
      return { status: 404, message: 'Evidence file not found.' };
    }
    throw error;
  }
}

module.exports = { readEvidenceBytes, writeEvidence };
