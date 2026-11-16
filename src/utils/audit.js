const { createHash } = require('node:crypto');

async function recordReportEvent(tx, userId, action, reportId) {
  // Serialize appenders so every event has exactly one preceding hash.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(26701, 1)`;
  const previous = await tx.auditLog.findFirst({
    orderBy: { id: 'desc' }, select: { chainHash: true },
  });
  const loggedAt = new Date();
  const data = { userId, action, entityType: 'report', entityId: reportId, loggedAt };
  const chainHash = createHash('sha256')
    .update(JSON.stringify([previous?.chainHash ?? null, data]))
    .digest('hex');
  return tx.auditLog.create({ data: { ...data, chainHash } });
}

module.exports = recordReportEvent;
