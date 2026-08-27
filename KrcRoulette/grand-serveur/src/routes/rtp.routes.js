const express = require('express');
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middlewares/auth');
const rtpStats = require('../services/rtpStats.service');

const router = express.Router();
router.use(requireAuth);

async function getEffectiveConfig(shopId) {
  const override = shopId ? await prisma.rtpConfig.findUnique({ where: { shopId } }) : null;
  if (override) return override;
  return prisma.rtpConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global' },
    update: {},
  });
}

router.get('/config', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const config = await getEffectiveConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.patch('/config', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { targetRtp, bonusRtp, alertYellow, alertRed } = req.body;
    const config = await prisma.rtpConfig.upsert({
      where: { id: 'global' },
      create: { id: 'global', targetRtp, bonusRtp, alertYellow, alertRed },
      update: { targetRtp, bonusRtp, alertYellow, alertRed },
    });
    res.json(config);
  } catch (err) {
    next(err);
  }
});

function scopeShopsWhere(auth) {
  if (auth.role === 'SUPER_ADMIN') return {};
  if (auth.role === 'ADMIN_VILLE') return { villeId: auth.villeId };
  return { id: auth.shopId };
}

router.get('/live', async (req, res, next) => {
  try {
    const shops = await prisma.shop.findMany({ where: scopeShopsWhere(req.auth) });
    const config = await getEffectiveConfig();

    const results = await Promise.all(
      shops.map(async (shop) => {
        const shopConfig = await getEffectiveConfig(shop.id);
        const projection = await rtpStats.getProjection(shop.id);

        let alert = null;
        if (projection.rtp >= shopConfig.alertRed) alert = 'red';
        else if (projection.rtp >= shopConfig.alertYellow) alert = 'yellow';

        return {
          shopId: shop.id,
          shopName: shop.name,
          bonusModeActive: shop.bonusModeActive,
          targetRtp: shop.bonusModeActive ? shopConfig.bonusRtp : shopConfig.targetRtp,
          ...projection,
          alert,
        };
      })
    );

    res.json({ config, shops: results });
  } catch (err) {
    next(err);
  }
});

router.get('/shop/:shopId', async (req, res, next) => {
  try {
    const shop = await prisma.shop.findFirst({ where: { id: req.params.shopId, ...scopeShopsWhere(req.auth) } });
    if (!shop) return res.status(404).json({ error: 'Shop introuvable' });

    const projection = await rtpStats.getProjection(shop.id);
    const config = await getEffectiveConfig(shop.id);
    res.json({ shop, config, ...projection });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
