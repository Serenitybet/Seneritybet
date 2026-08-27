const express = require('express');
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

// Super Admin: toutes les villes. Admin Ville: uniquement la sienne.
router.get('/', async (req, res, next) => {
  try {
    const where = req.auth.role === 'SUPER_ADMIN' ? {} : { id: req.auth.villeId };
    const villes = await prisma.ville.findMany({
      where,
      include: { _count: { select: { shops: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(villes);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name requis' });
    const ville = await prisma.ville.create({ data: { name } });
    res.status(201).json(ville);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name } = req.body;
    const ville = await prisma.ville.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json(ville);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
