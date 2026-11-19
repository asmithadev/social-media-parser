const { execFile } = require('node:child_process');

// Feed the already-verified bytes to local Tesseract. No shell or remote API.
function extractText(bytes) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.TESSERACT_PATH || 'tesseract',
      ['stdin', 'stdout', '-l', 'eng'],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
    child.stdin.on('error', () => {}); // A missing/failed executable may close stdin early.
    child.stdin.end(bytes);
  });
}

module.exports = extractText;
