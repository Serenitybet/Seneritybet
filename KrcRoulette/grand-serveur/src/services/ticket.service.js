const prisma = require('../config/prisma');
const { generateTicketCode } = require('./codes');
const { getPayoutMultiplier } = require('./roulette');
const creditService = require('./credit.service');

class TicketError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// bets: [{ betType, betValue, stake }]
async function createTicket({ shopId, createdByUserId, bets }) {
  if (!Array.isArray(bets) || bets.length === 0) {
    throw new TicketError('Le ticket doit contenir au moins une mise');
  }

  const enrichedBets = bets.map((b) => {
    if (!b.stake || b.stake <= 0) throw new TicketError('Chaque mise doit avoir un montant positif');
    return { ...b, payoutMultiplier: getPayoutMultiplier(b.betType) };
  });
  const totalStake = enrichedBets.reduce((sum, b) => sum + b.stake, 0);

  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop || !shop.isActive) throw new TicketError('Shop introuvable ou inactif', 404);

    const openRound = await tx.rouletteRound.findFirst({
      where: { shopId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });

    const ticket = await tx.ticket.create({
      data: {
        ticketCode: generateTicketCode(),
        shopId,
        roundId: openRound?.id,
        totalStake,
        createdByUserId,
        bets: { create: enrichedBets },
      },
      include: { bets: true, shop: true },
    });

    await creditService.debitShopForBet({
      shopId,
      amount: totalStake,
      performedByUserId: createdByUserId,
      note: `Mise ticket ${ticket.ticketCode}`,
      tx,
    });

    return ticket;
  });
}

async function findByCode(ticketCode) {
  return prisma.ticket.findUnique({
    where: { ticketCode },
    include: { bets: true, shop: true, round: true },
  });
}

async function payTicket({ ticketCode, shopId, performedByUserId }) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({ where: { ticketCode } });
    if (!ticket) throw new TicketError('Ticket introuvable', 404);
    if (ticket.shopId !== shopId) {
      throw new TicketError('Ce ticket appartient à un autre shop', 403);
    }
    if (ticket.status !== 'WON') {
      throw new TicketError(`Ticket non payable (statut: ${ticket.status})`, 400);
    }

    await creditService.creditShopForPayout({
      shopId,
      amount: ticket.totalPayout,
      performedByUserId,
      note: `Paiement ticket ${ticket.ticketCode}`,
      tx,
    });

    const paid = await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: 'PAID', paidAt: new Date() },
      include: { bets: true },
    });

    return paid;
  });
}

module.exports = { TicketError, createTicket, findByCode, payTicket };
