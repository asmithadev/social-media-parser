require('dotenv').config();
const express = require('express');
const prisma = require('./config/db-config');

// audit_logs.log_id is a BigInt; JSON.stringify cannot handle BigInt by default.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
app.use(express.json());

// Quick check that the server and the database are both up.
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'down' });
  }
});

// Module routes get mounted here later, for example:
// app.use('/api/cases', require('./routes/case.routes'));

module.exports = app;