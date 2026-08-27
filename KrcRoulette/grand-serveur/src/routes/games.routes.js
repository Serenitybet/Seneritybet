const express = require('express');
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const games = await prisma.game.findMany({ orderBy: { name: 'asc' } });
    res.json(games);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { key, name, isGlobalActive } = req.body;
    if (!key || !name) return res.status(400).json({ error: 'key et name requis' });
    const game = await prisma.game.create({ data: { key, name, isGlobalActive: isGlobalActive ?? true } });
    res.status(201).json(game);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ce jeu existe déjà' });
    next(err);
  }
});

router.patch('/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, isGlobalActive } = req.body;
    const game = await prisma.game.update({ where: { id: req.params.id }, data: { name, isGlobalActive } });
    res.json(game);
  } catch (err) {
    next(err);
  }
});

// Toggle d'un jeu pour un shop précis (case à cocher backoffice)
router.patch('/shop/:shopId/:gameId', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const { shopId, gameId } = req.params;
    const { isActive } = req.body;

    if (req.auth.role === 'ADMIN_VILLE') {
      const shop = await prisma.shop.findFirst({ where: { id: shopId, villeId: req.auth.villeId } });
      if (!shop) return res.status(403).json({ error: 'Accès refusé à ce shop' });
    }

    const shopGame = await prisma.shopGame.upsert({
      where: { shopId_gameId: { shopId, gameId } },
      create: { shopId, gameId, isActive: isActive ?? true },
      update: { isActive: isActive ?? true },
    });
    res.json(shopGame);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
