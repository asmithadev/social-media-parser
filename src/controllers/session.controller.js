const prisma = require('../config/db-config');
const { caseScope, readInput } = require('../utils/records');

async function listSessions(req, res) {
  const input = readInput(req, res, ['panchnamaId']);
  if (!input) return;
  const panchnama = await prisma.panchnama.findFirst({
    where: { id: input.panchnamaId, assignment: { case: caseScope(req.user) } },
    select: { sessions: { orderBy: { id: 'asc' } } },
  });
  if (!panchnama) return res.status(404).json({ message: 'Panchnama not found.' });
  return res.json(panchnama);
}


exports.listSessions = listSessions;
