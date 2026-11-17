
const app = require('./app');
const connectMongo = require('./config/mongo-config');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
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
