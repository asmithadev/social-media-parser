const mongoose = require('mongoose');
const prisma = require('../config/db-config');
const ParsedArtifact = require('../models/parsed-artifact');
const readEvidence = require('../utils/evidence-file');
const extractText = require('../services/ocr');
const parseEvidence = require('../services/parse-evidence');
const { withAuditActor } = require('../services/audit');
const { readInput } = require('../utils/records');

// This basic implementation runs in one API process, without a job queue.
const running = new Set();

async function parseScreenshot(req, res) {
  if (req.user.role !== 'examiner') return res.status(403).json({ message: 'Examiner access is required.' });
  const input = readInput(req, res, ['screenshotId']);
  if (!input) return;
  const screenshot = await prisma.screenshot.findFirst({
    where: { id: input.screenshotId, session: { panchnama: { examinerId: req.user.id } } },
  });
  if (!screenshot) return res.status(404).json({ message: 'Screenshot not found.' });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is unavailable. Please try again.' });
  if (running.has(screenshot.id)) return res.status(409).json({ message: 'OCR is already running for this screenshot.' });
  if (running.size >= 2) return res.status(429).json({ message: 'Two OCR jobs are running. Please retry shortly.' });
  running.add(screenshot.id);
  let started = false;
  const key = { screenshot_id: screenshot.id };
  const data = { engine: 'tesseract', language: 'eng', sha256Hash: screenshot.sha256Hash };
  try {
    await withAuditActor(req.user.id, tx => tx.screenshot.update({ where: { id: screenshot.id }, data: { parseStatus: 'pending' } }));
    started = true;
    await ParsedArtifact.findOneAndUpdate(key, {
      $set: { text: '', status: 'pending', error: null, data }, $unset: { structured: 1 },
    }, { upsert: true });
    const file = await readEvidence(screenshot.filePath, screenshot.sha256Hash);
    if (!file.bytes) {
      const error = new Error(file.message);
      error.publicMessage = file.message;
      throw error;
    }
    const text = await extractText(file.bytes);
    const artifact = await ParsedArtifact.findOneAndUpdate(key,
      { $set: { text, structured: parseEvidence(text), status: 'parsed', error: null, data } },
      { upsert: true, returnDocument: 'after' }).select('-_id').lean();
    await withAuditActor(req.user.id, tx => tx.screenshot.update({ where: { id: screenshot.id }, data: { parseStatus: 'parsed' } }));
    return res.json({ parseStatus: 'parsed', artifact });
  } catch (error) {
    if (!started) throw error;
    // Do not expose command stderr, private paths, or image content in errors/logs.
    const message = error.publicMessage || 'OCR failed. Check that Tesseract is installed and the PNG is readable, then retry.';
    await ParsedArtifact.findOneAndUpdate(key,
      { $set: { text: '', status: 'failed', error: message, data }, $unset: { structured: 1 } }, { upsert: true }).catch(() => {});
    await withAuditActor(req.user.id, tx => tx.screenshot.update({ where: { id: screenshot.id }, data: { parseStatus: 'failed' } }));
    return res.status(422).json({ message, parseStatus: 'failed' });
  } finally {
    running.delete(screenshot.id);
  }
}

module.exports = { parseScreenshot };
