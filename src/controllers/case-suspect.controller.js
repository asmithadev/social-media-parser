const { z } = require('zod');
const prisma = require('../config/db-config');
const { caseScope, id, readInput, writeRecord } = require('../utils/records');


const involvementSchema = z.strictObject({
  involvement: z.enum(['suspect', 'accused']),
  involvementDetails: z.string().trim().nullable().optional(),
});
const linkSchema = involvementSchema.extend({ suspectId: id });
const updateSchema = involvementSchema.partial().refine(data => Object.keys(data).length > 0);

async function listLinks(req, res) {
  const input = readInput(req, res, ['caseId']);
  if (!input) return;
  const record = await prisma.case.findFirst({
    where: { id: input.caseId, ...caseScope(req.user) },
    select: { caseSuspects: { orderBy: { id: 'asc' }, include: {
      suspect: { select: { id: true, fullName: true, alias: true } },
    } } },
  });
  if (!record) return res.status(404).json({ message: 'Case not found.' });
  return res.json({ suspects: record.caseSuspects });
}

async function linkSuspect(req, res) {
  const input = readInput(req, res, ['caseId'], linkSchema);
  if (!input) return;
  return writeRecord(res, 201, 'caseSuspect', () =>
    prisma.caseSuspect.create({ data: { caseId: input.caseId, ...input.data } }));
}

module.exports = { listLinks, linkSuspect };
