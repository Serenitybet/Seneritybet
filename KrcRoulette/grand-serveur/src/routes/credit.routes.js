const express = require('express');
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middlewares/auth');
const creditService = require('../services/credit.service');

const router = express.Router();
router.use(requireAuth);

// Super Admin ajuste son propre stock de crédit source
router.patch('/super-balance', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { balance } = req.body;
    if (balance === undefined || balance < 0) return res.status(400).json({ error: 'balance invalide' });
    const result = await creditService.setSuperAdminBalance(balance);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/super-balance', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await creditService.getSuperAdminCredit();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/recharge', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const { villeId, shopId, amount, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount invalide' });

    if (req.auth.role === 'SUPER_ADMIN') {
      if (!villeId) return res.status(400).json({ error: 'villeId requis' });
      const result = await creditService.superToVille({
        villeId,
        amount,
        performedByUserId: req.auth.userId,
        note,
      });
      return res.status(201).json(result);
    }

    // ADMIN_VILLE recharge un shop de sa propre ville
    if (!shopId) return res.status(400).json({ error: 'shopId requis' });
    const result = await creditService.villeToShop({
      villeId: req.auth.villeId,
      shopId,
      amount,
      performedByUserId: req.auth.userId,
      note,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const { shopId, villeId } = req.query;

    // Scope selon rôle: caissier ne voit que son shop, admin ville que sa ville
    let scopedShopId = shopId;
    let scopedVilleId = villeId;
    if (req.auth.role === 'CAISSIER') {
      scopedShopId = req.auth.shopId;
      scopedVilleId = undefined;
    } else if (req.auth.role === 'ADMIN_VILLE') {
      scopedVilleId = req.auth.villeId;
      if (shopId) {
        const shop = await prisma.shop.findFirst({ where: { id: shopId, villeId: req.auth.villeId } });
        if (!shop) return res.status(403).json({ error: 'Accès refusé à ce shop' });
        scopedShopId = shopId;
        scopedVilleId = undefined;
      }
    }

    const history = await creditService.getHistory({ shopId: scopedShopId, villeId: scopedVilleId });
    res.json(history);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
