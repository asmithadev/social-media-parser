const prisma = require('../config/db-config');
const { readInput } = require('../utils/records');

async function listPlatforms(req, res) {
  const platforms = await prisma.platform.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  return res.json({ platforms });
}

module.exports = { listPlatforms };
