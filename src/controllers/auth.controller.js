const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1),
});

function login(req, res) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Provide a valid email and a non-empty password.',
    });
  }

  return res.status(501).json({ message: 'Login handler reached' });
}

module.exports = { login };