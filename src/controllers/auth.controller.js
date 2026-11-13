const { z } = require('zod');
const bcrypt = require('bcrypt');
const prisma = require('../config/db-config');

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1),
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
    select: { active: true, passwordHash: true },
    });

    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.status(200).json({ message: 'Credentials verified' });
}

module.exports = { login };