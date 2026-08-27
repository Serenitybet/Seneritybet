const express = require('express');
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { generateWorkCode } = require('../services/codes');

const router = express.Router();
router.use(requireAuth);

function scopeWhere(auth) {
  if (auth.role === 'SUPER_ADMIN') return {};
  if (auth.role === 'ADMIN_VILLE') return { villeId: auth.villeId };
  return { id: auth.shopId }; // CAISSIER: uniquement son shop
}

router.get('/', async (req, res, next) => {
  try {
    const shops = await prisma.shop.findMany({
      where: scopeWhere(req.auth),
      include: { ville: true },
      orderBy: { name: 'asc' },
    });
    res.json(shops);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const shop = await prisma.shop.findFirst({
      where: { id: req.params.id, ...scopeWhere(req.auth) },
      include: { ville: true, shopGames: { include: { game: true } } },
    });
    if (!shop) return res.status(404).json({ error: 'Shop introuvable' });
    res.json(shop);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const { name, villeId, creditAlertThreshold, roundTimerSeconds } = req.body;
    if (!name) return res.status(400).json({ error: 'name requis' });

    const targetVilleId = req.auth.role === 'ADMIN_VILLE' ? req.auth.villeId : villeId;
    if (!targetVilleId) return res.status(400).json({ error: 'villeId requis' });

    const shop = await prisma.shop.create({
      data: {
        name,
        villeId: targetVilleId,
        workCode: generateWorkCode(),
        creditAlertThreshold: creditAlertThreshold ?? 5000,
        roundTimerSeconds: roundTimerSeconds ?? 30,
      },
    });
    res.status(201).json(shop);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const shop = await prisma.shop.findFirst({ where: { id: req.params.id, ...scopeWhere(req.auth) } });
    if (!shop) return res.status(404).json({ error: 'Shop introuvable' });

    const { name, creditAlertThreshold, roundTimerSeconds, isActive } = req.body;
    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: { name, creditAlertThreshold, roundTimerSeconds, isActive },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/regenerate-code', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const shop = await prisma.shop.findFirst({ where: { id: req.params.id, ...scopeWhere(req.auth) } });
    if (!shop) return res.status(404).json({ error: 'Shop introuvable' });

    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: { workCode: generateWorkCode() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/bonus-mode', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { durationDays } = req.body;
    if (!durationDays || durationDays <= 0) {
      return res.status(400).json({ error: 'durationDays requis (> 0)' });
    }
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const shop = await prisma.shop.update({
      where: { id: req.params.id },
      data: { bonusModeActive: true, bonusModeExpiresAt: expiresAt },
    });
    res.json(shop);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/bonus-mode', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const shop = await prisma.shop.update({
      where: { id: req.params.id },
      data: { bonusModeActive: false, bonusModeExpiresAt: null },
    });
    res.json(shop);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
