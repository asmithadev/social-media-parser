const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Keep module imports available for isolated tests; the server rejects missing
// production connection settings before it opens a listener.
const connectionString = process.env.DATABASE_URL ||
  'postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured';
const schema = new URL(connectionString).searchParams.get('schema') || 'public';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('DATABASE_URL has an invalid PostgreSQL schema name.');
const adapter = new PrismaPg({
  connectionString,
  options: `-c search_path=${schema},public`,
}, { schema });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
