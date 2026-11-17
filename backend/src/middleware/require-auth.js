const jwt = require('jsonwebtoken');
const prisma = require('../config/db-config');

async function requireAuth(req, res, next) {
  const token = req.get('authorization')?.match(/^Bearer +([^\s]+)$/i)?.[1];

  if (!token) {
    return res.status(401).json({ message: 'A valid access token is required.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Authentication is unavailable.' });
  }

  let claims;
  try {
    claims = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'A valid access token is required.' });
  }

  const userId = Number(claims?.sub);
  if (typeof claims?.sub !== 'string' || String(userId) !== claims.sub ||
      !Number.isInteger(userId) || userId < 1 || userId > 2147483647) {
    return res.status(401).json({ message: 'A valid access token is required.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, role: true, active: true },
  });

  if (!user?.active) {
    return res.status(401).json({ message: 'A valid access token is required.' });
  }

  req.user = user;
  return next();
}

module.exports = requireAuth;
