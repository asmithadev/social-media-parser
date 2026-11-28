const { execFile } = require('node:child_process');

// Vercel Functions do not include a system Tesseract executable. Run the same
// English OCR engine through WASM there; locally keep using the installed CLI.
function extractText(bytes, format) {
  if (process.env.VERCEL === '1') return extractWithWasm(bytes, format);
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.TESSERACT_PATH || 'tesseract',
      ['stdin', 'stdout', '-l', 'eng', ...(format ? [format] : [])],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
    child.stdin.on('error', () => {}); // A missing/failed executable may close stdin early.
    child.stdin.end(bytes);
  });
}

async function extractWithWasm(bytes, format) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng', 1, {
    cachePath: '/tmp/tesseract-cache',
    logger: () => {},
  });
  try {
    const output = format === 'tsv' ? { text: false, tsv: true } : { text: true };
    const { data } = await worker.recognize(bytes, {}, output);
    return format === 'tsv' ? data.tsv : data.text.trim();
  } finally {
    await worker.terminate();
  }
}

module.exports = extractText;
