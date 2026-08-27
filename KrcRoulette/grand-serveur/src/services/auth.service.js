const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');

const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      villeId: user.villeId,
      shopId: user.shopId,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function login(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  const token = signToken(user);
  const { passwordHash, ...safeUser } = user;
  return { token, user: safeUser };
}

module.exports = { hashPassword, verifyPassword, signToken, login };
