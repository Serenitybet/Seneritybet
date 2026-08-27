const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const reportService = require('../services/report.service');

const router = express.Router();
router.use(requireAuth);

function scopeParams(req) {
  const { shopId, from, to } = req.query;
  if (req.auth.role === 'CAISSIER') return { shopId: req.auth.shopId, from, to };
  if (req.auth.role === 'ADMIN_VILLE') return { shopId, villeId: req.auth.villeId, from, to };
  return { shopId, villeId: req.query.villeId, from, to };
}

router.get('/', async (req, res, next) => {
  try {
    const reports = await reportService.getReports(scopeParams(req));
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

router.post('/generate', requireRole('SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const { shopId, date } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    if (shopId) {
      const report = await reportService.generateDailyReport(shopId, targetDate);
      return res.status(201).json(report);
    }
    const reports = await reportService.generateAllDailyReports(targetDate);
    res.status(201).json(reports);
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const reports = await reportService.getReports(scopeParams(req));
    const buffer = await reportService.buildWorkbook(reports);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="krcroulette-rapports.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
