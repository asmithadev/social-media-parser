require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./config/db-config');
const mongoose = require('mongoose');
const createLoginRateLimit = require('./middleware/login-rate-limit');

// audit_logs.log_id is a BigInt; JSON.stringify cannot handle BigInt by default.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
const getSafeErrorDetails = error => ({
  name: typeof error?.name === 'string' ? error.name : 'Error',
  code: typeof error?.code === 'string' ? error.code : undefined,
  causeCode: typeof error?.cause?.code === 'string' ? error.cause.code : undefined,
  databaseCode: typeof error?.meta?.code === 'string' ? error.meta.code : undefined,
});
const allowedOrigins = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients and same-origin requests do not send an Origin header.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
}));
app.use(express.json({ limit: '256kb' }));
app.use('/api/auth/login', createLoginRateLimit());

const trustProxyHops = process.env.TRUST_PROXY_HOPS;
if (trustProxyHops !== undefined && trustProxyHops !== '') {
  if (!/^\d+$/.test(trustProxyHops)) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  app.set('trust proxy', Number(trustProxyHops));
}

app.get('/health/live', (req, res) => res.json({ status: 'ok' }));

// Readiness reports dependency state without exposing connection errors or URLs.
app.get('/health', async (req, res) => {
  let postgres = 'unavailable';
  try {
    await prisma.$queryRaw`SELECT 1`;
    postgres = 'connected';
  } catch (error) {
    // Log only error identifiers; never include connection strings or SQL values.
    console.error('PostgreSQL readiness check failed', getSafeErrorDetails(error));
  }
  const mongodb = mongoose.connection.readyState === 1 ? 'connected' : 'unavailable';
  const ready = postgres === 'connected' && mongodb === 'connected';
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'error', postgres, mongodb,
  });
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/audit-logs', require('./routes/audit.routes'));

app.use('/api/users', require('./routes/user.routes'));
app.use('/api/cases', require('./routes/case.routes'));

app.use('/api', require('./routes/suspect.routes'));

app.use('/api', require('./routes/case-suspect.routes'));

app.use('/api', require('./routes/account.routes'));

app.use('/api', require('./routes/platform.routes'));

app.use('/api', require('./routes/panchnama.routes'));

app.use('/api', require('./routes/session.routes'));

app.use('/api', require('./routes/report.routes'));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('API request failed', {
    method: req.method,
    route: req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched',
    ...getSafeErrorDetails(error),
  });
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }
  return res.status(500).json({ message: 'Unexpected server error.' });
});

module.exports = app;
