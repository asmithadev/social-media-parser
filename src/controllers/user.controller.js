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

module.exports = { listUsers };
