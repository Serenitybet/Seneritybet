const express = require('express');
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middlewares/auth');
const authService = require('../services/auth.service');

const router = express.Router();
router.use(requireAuth);

function hasVillePermission(auth, key) {
  return auth.role === 'SUPER_ADMIN' || auth.permissions?.[key] === true;
}

async function loadCallerPermissions(req, res, next) {
  if (req.auth.role === 'ADMIN_VILLE') {
    const me = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    req.auth.permissions = me?.permissions || {};
  }
  next();
}

router.use(loadCallerPermissions);

function scopeWhere(auth) {
  if (auth.role === 'SUPER_ADMIN') return {};
  if (auth.role === 'ADMIN_VILLE') return { villeId: auth.villeId, role: 'CAISSIER' };
  return { id: auth.userId };
}

router.get('/', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: scopeWhere(req.auth),
      include: { ville: true, shop: true },
      orderBy: { username: 'asc' },
    });
    res.json(users.map(({ passwordHash, ...u }) => u));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const { username, password, role, villeId, shopId, permissions } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password, role requis' });
    }

    if (req.auth.role === 'ADMIN_VILLE') {
      if (role !== 'CAISSIER') {
        return res.status(403).json({ error: "Un Admin Ville ne peut créer que des caissiers" });
      }
      if (!hasVillePermission(req.auth, 'canManageUsers')) {
        return res.status(403).json({ error: 'Permission canManageUsers requise' });
      }
      if (!shopId) return res.status(400).json({ error: 'shopId requis' });
      const shop = await prisma.shop.findFirst({ where: { id: shopId, villeId: req.auth.villeId } });
      if (!shop) return res.status(403).json({ error: "Ce shop n'appartient pas à votre ville" });
    }

    if (role === 'ADMIN_VILLE' && !villeId) {
      return res.status(400).json({ error: 'villeId requis pour un Admin Ville' });
    }
    if (role === 'CAISSIER' && !shopId) {
      return res.status(400).json({ error: 'shopId requis pour un Caissier' });
    }

    const passwordHash = await authService.hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
        villeId: role === 'ADMIN_VILLE' ? villeId : null,
        shopId: role === 'CAISSIER' ? shopId : null,
        permissions: role === 'ADMIN_VILLE' ? permissions || {} : {},
      },
    });
    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: "Ce nom d'utilisateur existe déjà" });
    }
    next(err);
  }
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, ...scopeWhere(req.auth) } });
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { isActive, permissions, password } = req.body;
    const data = {};
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.passwordHash = await authService.hashPassword(password);
    if (req.auth.role === 'SUPER_ADMIN' && permissions !== undefined && target.role === 'ADMIN_VILLE') {
      data.permissions = permissions;
    }

    const updated = await prisma.user.update({ where: { id: target.id }, data });
    const { passwordHash, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
