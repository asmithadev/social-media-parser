const prisma = require('../config/db-config');

// Actor context is transaction-local: it cannot leak through the connection
// pool to another request. Acquire the chain lock before any domain row lock.
function withAuditActor(userId, mutation) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7419302601::bigint)`;
    await tx.$queryRaw`SELECT set_config('app.audit_user_id', ${String(userId)}, true)`;
    return mutation(tx);
  }, { isolationLevel: 'ReadCommitted' });
}

// PostgreSQL computes the timestamp and chain hash. Caller-supplied digests
// cannot be trusted; the placeholder is overwritten by the INSERT trigger.
function recordLogin({ userId = null, success, reason }) {
  return prisma.auditLog.create({
    data: {
      userId,
      action: success ? 'LOGIN_SUCCEEDED' : 'LOGIN_FAILED',
      detail: JSON.stringify({ reason }),
      chainHash: '0'.repeat(64),
    },
  });
}

module.exports = { withAuditActor, recordLogin };
