const prisma = require('../config/db-config');
const { readInput } = require('../utils/records');

async function listPlatforms(req, res) {
  const platforms = await prisma.platform.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  return res.json({ platforms });
}

async function listSections(req, res) {
  const input = readInput(req, res, ['platformId']);
  if (!input) return;
  const platform = await prisma.platform.findFirst({
    where: { id: input.platformId, active: true },
    select: { sections: { orderBy: { id: 'asc' } } },
  });
  if (!platform) return res.status(404).json({ message: 'Active platform not found.' });
  return res.json(platform);
}

module.exports = { listPlatforms, listSections };
