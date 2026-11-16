const { z } = require('zod');
const prisma = require('../config/db-config');

const auditId = z.string().regex(/^[1-9][0-9]{0,18}$/)
  .transform(BigInt).refine(value => value <= 9223372036854775807n);

const listSchema = z.strictObject({
  after: auditId.optional(),
  limit: z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number)
    .pipe(z.number().max(100)).optional(),
});

async function listLogs(req, res) {
  const input = listSchema.safeParse(req.query);
  if (!input.success) return res.status(400).json({ message: 'Provide a valid audit cursor and a limit from 1 to 100.' });
  const limit = input.data.limit ?? 50;
  const rows = await prisma.auditLog.findMany({
    where: input.data.after ? { id: { gt: input.data.after } } : {},
    orderBy: { id: 'asc' },
    take: limit + 1,
  });
  const logs = rows.slice(0, limit);
  return res.json({ logs, nextCursor: rows.length > limit ? logs.at(-1).id.toString() : null });
}

const verifySchema = z.strictObject({
  checkpointId: auditId.optional(),
  checkpointHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).refine(data => Boolean(data.checkpointId) === Boolean(data.checkpointHash));

async function verifyChain(req, res) {
  const input = verifySchema.safeParse(req.query);
  if (!input.success) return res.status(400).json({ message: 'Provide both a checkpointId and a lowercase SHA-256 checkpointHash, or neither.' });
  const { checkpointId = null, checkpointHash = null } = input.data;
  const [result] = await prisma.$queryRaw`
    SELECT valid, checked, head_id AS "headId", head_hash AS "headHash",
      first_invalid_id AS "firstInvalidId", checkpoint_matches AS "checkpointMatches"
    FROM verify_audit_chain(${checkpointId}::bigint, ${checkpointHash}::text)`;
  return res.json(result);
}

module.exports = { listLogs, verifyChain };
