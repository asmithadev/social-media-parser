const bcrypt = require('bcrypt');
const { z } = require('zod');
const prisma = require('../config/db-config');
const recordId = require('../utils/record-id');

const fullName = z.string().trim().min(1).max(150);
const createUserSchema = z.strictObject({
  email: z.string().trim().max(255).pipe(z.email()),
  fullName,
  role: z.enum(['examiner', 'reviewer']),
  password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72),
});

const updateUserSchema = z.strictObject({
  fullName: fullName.optional(),
  active: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0);

const select = { id: true, email: true, fullName: true, role: true, active: true, createdAt: true };

async function listUsers(req, res) {
  const users = await prisma.user.findMany({ select, orderBy: { id: 'asc' } });
  return res.json({ users });
}

async function createUser(req, res) {
  const input = createUserSchema.safeParse(req.body);
  if (!input.success) {
    return res.status(400).json({
      message: 'Provide an email, full name, examiner or reviewer role, and password of 1 to 72 bytes.',
    });
  }

  const { password, ...profile } = input.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({ data: { ...profile, passwordHash }, select });
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A user with that email already exists.' });
    }
    throw error;
  }
}

async function updateUser(req, res) {
  const id = recordId.safeParse(req.params.userId);
  const input = updateUserSchema.safeParse(req.body);
  if (!id.success || !input.success) {
    return res.status(400).json({ message: 'Provide a valid user ID and a full name or active status.' });
  }
  if (id.data === req.user.id && input.data.active === false) {
    return res.status(409).json({ message: 'You cannot deactivate your own account.' });
  }

  try {
    const user = await prisma.user.update({ where: { id: id.data }, data: input.data, select });
    return res.json({ user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found.' });
    }
    throw error;
  }
}

module.exports = { listUsers, createUser, updateUser };
