const { z } = require('zod');
const prisma = require('../config/db-config');
const { suspectScope, readInput, writeRecord } = require('../utils/records');


const suspectSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(150),
  alias: z.string().trim().max(150).nullable().optional(),
  dateOfBirth: z.iso.date().transform(value => new Date(value + 'T00:00:00Z')).nullable().optional(),
  aadharNumber: z.string().regex(/^[0-9]{12}$/).nullable().optional(),
});
const updateSchema = suspectSchema.partial().refine(data => Object.keys(data).length > 0);
const publicFields = { id: true, fullName: true, alias: true, dateOfBirth: true, createdAt: true };

async function listSuspects(req, res) {
  const query = z.string().trim().max(150).optional().safeParse(req.query.q);
  if (!query.success) return res.status(400).json({ message: 'Invalid search query.' });
  const where = suspectScope(req.user);
  if (query.data) {
    const contains = { contains: query.data, mode: 'insensitive' };
    where.OR = [{ fullName: contains }, { alias: contains }];
  }
  const suspects = await prisma.suspect.findMany({ where, select: publicFields, orderBy: { id: 'asc' } });
  return res.json({ suspects });
}

async function getSuspect(req, res) {
  const input = readInput(req, res, ['suspectId']);
  if (!input) return;
  const suspect = await prisma.suspect.findFirst({
    where: { id: input.suspectId, ...suspectScope(req.user) },
    select: publicFields,
  });
  if (!suspect) return res.status(404).json({ message: 'Suspect not found.' });
  return res.json({ suspect });
}

async function createSuspect(req, res) {
  const input = readInput(req, res, [], suspectSchema);
  if (!input) return;
  return writeRecord(res, 201, 'suspect', () =>
    prisma.suspect.create({ data: input.data, select: publicFields }));
}

module.exports = { listSuspects, getSuspect, createSuspect };
