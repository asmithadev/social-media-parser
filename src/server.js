const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // Replace with the Winston logger once utils/logger.js exists.
  console.log(`Server running on port ${PORT}`);
});