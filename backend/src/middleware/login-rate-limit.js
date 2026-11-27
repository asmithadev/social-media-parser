const { rateLimit } = require('express-rate-limit');

module.exports = function createLoginRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  });
};
