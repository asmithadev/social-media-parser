const { z } = require('zod');

module.exports = z.string().regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .pipe(z.number().int().max(2147483647));
