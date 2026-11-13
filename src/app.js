require('dotenv').config();
const express = require('express');
const prisma = require('./config/db-config');
const mongoose = require('mongoose');

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

    const mongoConnected = mongoose.connection.readyState === 1;

    if (!mongoConnected) {
      throw new Error('MongoDB is not connected');
    }

    res.json({
      status: 'ok',
      postgres: 'connected',
      mongodb: 'connected'
    });

  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

app.use('/api/auth', require('./routes/auth.routes'));

// Module routes get mounted here later, for example:
// app.use('/api/cases', require('./routes/case.routes'));

module.exports = app;