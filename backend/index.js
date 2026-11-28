const express = require('express');
const mongoose = require('mongoose');
const app = require('./src/app');
const connectMongo = require('./src/config/mongo-config');

// Vercel invokes this Express handler per request. Reuse the MongoDB connection
// while a function instance is warm and reconnect after a failed connection.
const server = express();
let mongoConnection;

function validateRuntimeConfig() {
  const hasPostgres = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  const hasMongo = Boolean(process.env.MONGO_URI || process.env.MONGODB_URI);
  if (!hasPostgres || !hasMongo) throw new Error('Database configuration is missing.');
  const secret = process.env.JWT_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32 || /replace[_-]with|change[_-]me|example/i.test(secret)) {
    throw new Error('JWT configuration is invalid.');
  }
}

server.use(async (req, res, next) => {
  if (req.path === '/health/live') return app(req, res);
  try {
    validateRuntimeConfig();
    if (mongoose.connection.readyState !== 1) {
      mongoConnection ||= connectMongo().catch(error => {
        mongoConnection = null;
        throw error;
      });
      await mongoConnection;
    }
    return next();
  } catch {
    return res.status(503).json({ message: 'Service dependencies are unavailable.' });
  }
});

server.use(app);
module.exports = server;
