const { createHash, randomUUID } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const renderReport = require('../utils/report-pdf');
const readEvidence = require('../utils/evidence-file');
const recordReportEvent = require('../utils/audit');
const prisma = require('../config/db-config');
const { caseScope, readInput } = require('../utils/records');

function panchnamaScope(user) {
  return { assignment: { case: caseScope(user) } };
}

async function listReports(req, res) {
  const input = readInput(req, res, ['panchnamaId']);
  if (!input) return;
  const panchnama = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, ...panchnamaScope(req.user) },
    select: {
      reports: { orderBy: { versionNo: 'desc' }, omit: { filePath: true } },
    },
  });
  if (!panchnama) return res.status(404).json({ message: 'Panchnama not found.' });
  return res.json(panchnama);
}

exports.listReports = listReports;

async function getReport(req, res) {
  const input = readInput(req, res, ['reportId']);
  if (!input) return;
  const report = await prisma.report.findFirst({
    where: { id: input.reportId, panchnama: panchnamaScope(req.user) },
    omit: { filePath: true },
  });
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  return res.json({ report });
}

exports.getReport = getReport;

async function generateReport(req, res) {
  if (!['admin', 'examiner'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Examiner or administrator access is required.' });
  }
  const input = readInput(req, res, ['panchnamaId']);
  if (!input) return;
  const record = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, ...panchnamaScope(req.user) },
    include: {
      assignment: { include: { case: { select: { caseNumber: true } }, user: { select: { fullName: true } } } },
      witnesses: { orderBy: { id: 'asc' }, select: { fullName: true } },
      sessions: {
        orderBy: { id: 'asc' },
        include: {
          account: { include: { platform: { include: { sections: { orderBy: { id: 'asc' } } } } } },
          outcomes: true,
          screenshots: { orderBy: [{ platformSectionId: 'asc' }, { sequenceNo: 'asc' }], include: { section: true } },
        },
      },
    },
  });
  if (!record) return res.status(404).json({ message: 'Panchnama not found.' });
  if (record.sessions.some(session => session.status === 'open')) {
    return res.status(409).json({ message: 'Finish open capture sessions before generating a report.' });
  }

  const result = await prisma.$transaction(async tx => {
    // Lock the parent while allocating the next report version.
    await tx.$queryRaw`SELECT panchnama_id FROM panchnamas WHERE panchnama_id = ${record.id} FOR UPDATE`;
    const latest = await tx.report.findFirst({
      where: { panchnamaId: record.id }, orderBy: { versionNo: 'desc' }, select: { versionNo: true },
    });
    const versionNo = (latest?.versionNo ?? 0) + 1;
    const rendered = await renderReport(record, versionNo);
    if (!rendered.bytes) return rendered;

    const filePath = path.join('reports', randomUUID() + '.pdf');
    const absolutePath = path.resolve(process.env.EVIDENCE_DIR || 'evidence', filePath);
    const sha256Hash = createHash('sha256').update(rendered.bytes).digest('hex');
    await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
    const report = await tx.report.create({
      data: { panchnamaId: record.id, versionNo, filePath, sha256Hash, generatedBy: req.user.id },
      omit: { filePath: true },
    });
    await recordReportEvent(tx, req.user.id, 'REPORT_GENERATED', report.id);
    await writeFile(absolutePath, rendered.bytes, { flag: 'wx', mode: 0o600, flush: true });
    return { report };
  }, { timeout: 30000 });

  if (!result.report) return res.status(result.status).json({ message: result.message });
  return res.status(201).json(result);
}

exports.generateReport = generateReport;

async function downloadReport(req, res) {
  const input = readInput(req, res, ['reportId']);
  if (!input) return;
  const report = await prisma.report.findFirst({
    where: { id: input.reportId, panchnama: panchnamaScope(req.user) },
    select: { filePath: true, sha256Hash: true },
  });
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  const result = await readEvidence(report.filePath, report.sha256Hash);
  if (!result.bytes) return res.status(result.status).json({ message: result.message });
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return res.attachment('report-' + input.reportId + '.pdf').send(result.bytes);
}

exports.downloadReport = downloadReport;

async function approveReport(req, res) {
  if (!['admin', 'reviewer'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Reviewer or administrator access is required.' });
  }
  const input = readInput(req, res, ['reportId']);
  if (!input) return;
  const where = { id: input.reportId, panchnama: panchnamaScope(req.user) };
  const result = await prisma.$transaction(async tx => {
    const report = await tx.report.findFirst({ where, omit: { filePath: true } });
    if (!report) return { status: 404, message: 'Report not found.' };
    if (report.generatedBy === req.user.id) {
      return { status: 403, message: 'The report author cannot approve this version.' };
    }
    if (report.approvedBy === req.user.id) return { report };
    const [approved] = await tx.report.updateManyAndReturn({
      where: { ...where, approvedBy: null },
      data: { approvedBy: req.user.id, approvedAt: new Date() },
      omit: { filePath: true },
    });
    if (!approved) {
      const current = await tx.report.findFirst({ where, omit: { filePath: true } });
      if (current?.approvedBy === req.user.id) return { report: current };
      return { status: 409, message: 'This report version has already been approved.' };
    }
    await recordReportEvent(tx, req.user.id, 'REPORT_APPROVED', approved.id);
    return { report: approved };
  });
  if (!result.report) return res.status(result.status).json({ message: result.message });
  return res.json(result);
}

exports.approveReport = approveReport;

async function requestPrint(req, res) {
  const input = readInput(req, res, ['reportId']);
  if (!input) return;
  const event = await prisma.$transaction(async tx => {
    const report = await tx.report.findFirst({
      where: { id: input.reportId, panchnama: panchnamaScope(req.user) },
      select: { id: true },
    });
    if (!report) return null;
    return recordReportEvent(tx, req.user.id, 'REPORT_PRINT_REQUESTED', report.id);
  });
  if (!event) return res.status(404).json({ message: 'Report not found.' });
  return res.status(201).json({ auditLogId: String(event.id) });
}

exports.requestPrint = requestPrint;
