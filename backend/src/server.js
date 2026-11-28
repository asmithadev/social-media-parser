
const app = require('./app');
const connectMongo = require('./config/mongo-config');

const PORT = process.env.PORT || 3000;

function validateRuntimeConfig() {
  const missing = [
    ['DATABASE_URL', 'POSTGRES_URL'],
    ['MONGO_URI', 'MONGODB_URI'],
  ].filter(names => !names.some(name => process.env[name])).map(names => names[0]);
  if (missing.length) throw new Error('Missing required environment settings: ' + missing.join(', '));
  if (process.env.NODE_ENV === 'production' &&
      (Buffer.byteLength(process.env.JWT_SECRET || '', 'utf8') < 32 ||
       /replace[_-]with|change[_-]me|example/i.test(process.env.JWT_SECRET || ''))) {
    throw new Error('Set JWT_SECRET to a unique random value of at least 32 bytes before starting in production.');
  }
}

const startServer = async () => {
  try {
    validateRuntimeConfig();
    await connectMongo();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
