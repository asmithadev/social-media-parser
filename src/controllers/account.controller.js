const { z } = require('zod');
const prisma = require('../config/db-config');
const { suspectScope, id, readInput, writeRecord } = require('../utils/records');


const accountFields = z.strictObject({
  handle: z.string().trim().min(1).max(150),
  platformAccountId: z.string().trim().min(1).max(100).nullable().optional(),
  profileUrl: z.string().trim().pipe(z.url({ protocol: /^https?$/ })).nullable().optional(),
});
const createSchema = accountFields.extend({ platformId: id });
const updateSchema = accountFields.partial().refine(data => Object.keys(data).length > 0);

async function listAccounts(req, res) {
  const input = readInput(req, res, ['suspectId']);
  if (!input) return;
  const suspect = await prisma.suspect.findFirst({
    where: { id: input.suspectId, ...suspectScope(req.user) },
    select: { accounts: { orderBy: { id: 'asc' } } },
  });
  if (!suspect) return res.status(404).json({ message: 'Suspect not found.' });
  return res.json(suspect);
}

async function createAccount(req, res) {
  const input = readInput(req, res, ['suspectId'], createSchema);
  if (!input) return;
  const platform = await prisma.platform.findFirst({
    where: { id: input.data.platformId, active: true },
    select: { id: true },
  });
  if (!platform) return res.status(404).json({ message: 'Active platform not found.' });
  return writeRecord(res, 201, 'account', () =>
    prisma.socialAccount.create({ data: { suspectId: input.suspectId, ...input.data } }));
}

module.exports = { listAccounts, createAccount };
