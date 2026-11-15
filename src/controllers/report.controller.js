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
