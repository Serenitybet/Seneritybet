const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ticketService = require('../services/ticket.service');

const router = express.Router();
router.use(requireAuth);

router.post('/', requireRole('CAISSIER'), async (req, res, next) => {
  try {
    const { bets } = req.body;
    const ticket = await ticketService.createTicket({
      shopId: req.auth.shopId,
      createdByUserId: req.auth.userId,
      bets,
    });
    res.status(201).json(ticket);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/:code', requireRole('CAISSIER', 'SUPER_ADMIN', 'ADMIN_VILLE'), async (req, res, next) => {
  try {
    const ticket = await ticketService.findByCode(req.params.code);
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

    if (req.auth.role === 'CAISSIER' && ticket.shopId !== req.auth.shopId) {
      return res.status(403).json({ error: 'Ce ticket appartient à un autre shop' });
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:code/pay', requireRole('CAISSIER'), async (req, res, next) => {
  try {
    const ticket = await ticketService.payTicket({
      ticketCode: req.params.code,
      shopId: req.auth.shopId,
      performedByUserId: req.auth.userId,
    });
    res.json(ticket);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
