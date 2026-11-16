const { z } = require('zod');
const prisma = require('../config/db-config');

const querySchema = z.strictObject({
  before: z.string().regex(/^[1-9][0-9]{0,18}$/).transform(BigInt)
    .refine(value => value <= 9223372036854775807n).optional(),
});

async function listAuditLogs(req, res) {
  const input = querySchema.safeParse(req.query);
  if (!input.success) return res.status(400).json({ message: 'Invalid audit log cursor.' });
  const { before } = input.data;
  const events = await prisma.auditLog.findMany({
    where: before === undefined ? {} : { id: { lt: before } },
    orderBy: { id: 'desc' },
    take: 51,
  });
  return res.json({
    auditLogs: events.slice(0, 50),
    nextCursor: events.length > 50 ? String(events[49].id) : null,
  });
}

exports.listAuditLogs = listAuditLogs;
