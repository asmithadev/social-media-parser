const { z } = require('zod');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db-config');

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72
  ),
});

async function login(req, res) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Provide a valid email and a non-empty password.',
    });
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, active: true, passwordHash: true },
  });

  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ message: 'Login is unavailable.' });
  }

  const accessToken = jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: '1h',
  });

  return res.status(200).json({ accessToken });
}

module.exports = { login };
