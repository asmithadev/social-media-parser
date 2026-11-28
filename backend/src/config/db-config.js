const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Keep module imports available for isolated tests; the server rejects missing
// production connection settings before it opens a listener.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL ||
  'postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured';
const schema = new URL(connectionString).searchParams.get('schema') || 'public';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('DATABASE_URL has an invalid PostgreSQL schema name.');
// Neon’s pooled endpoint rejects search_path in PostgreSQL startup options
// (SQLSTATE 08P01). Prisma models use the public schema by default; keep schema
// metadata on the adapter without sending a startup option to the pooler.
const adapter = new PrismaPg({ connectionString }, { schema });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
