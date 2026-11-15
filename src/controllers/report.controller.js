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
