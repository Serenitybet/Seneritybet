const prisma = require('../config/prisma');
const rtpEngine = require('./rtpEngine');
const rtpStats = require('./rtpStats.service');
const { emitToShop } = require('../socket/index');

const TICK_MS = 1000;
let io = null;
let timer = null;

async function isRouletteActiveForShop(shopId) {
  const roulette = await prisma.game.findUnique({ where: { key: 'roulette' } });
  if (!roulette || !roulette.isGlobalActive) return false;

  const shopGame = await prisma.shopGame.findUnique({
    where: { shopId_gameId: { shopId, gameId: roulette.id } },
  });
  // Pas de toggle explicite => actif par défaut (jeu de base)
  return shopGame ? shopGame.isActive : true;
}

async function getEffectiveRtpConfig(shopId) {
  const override = await prisma.rtpConfig.findUnique({ where: { shopId } });
  if (override) return override;
  return prisma.rtpConfig.upsert({ where: { id: 'global' }, create: { id: 'global' }, update: {} });
}

async function openRound(shop) {
  const last = await prisma.rouletteRound.findFirst({
    where: { shopId: shop.id },
    orderBy: { roundNumber: 'desc' },
  });
  const roundNumber = (last?.roundNumber || 0) + 1;
  const closesAt = new Date(Date.now() + shop.roundTimerSeconds * 1000);

  const round = await prisma.rouletteRound.create({
    data: { shopId: shop.id, roundNumber, closesAt },
  });

  emitToShop(io, shop.workCode, 'round:opened', {
    roundId: round.id,
    roundNumber: round.roundNumber,
    closesAt: round.closesAt,
    timerSeconds: shop.roundTimerSeconds,
  });

  return round;
}

async function settleRound(shop, round) {
  const bets = await prisma.ticketBet.findMany({
    where: { ticket: { roundId: round.id, status: 'PENDING' } },
  });

  const isBonusActive = shop.bonusModeActive && (!shop.bonusModeExpiresAt || shop.bonusModeExpiresAt > new Date());
  const rtpConfig = await getEffectiveRtpConfig(shop.id);
  const monthlyStats = await rtpStats.getMonthlyStats(shop.id);

  const winningNumber = rtpEngine.decideWinningNumber({ openBets: bets, monthlyStats, rtpConfig, isBonusActive });
  const { settled, totalPayout, winningColor } = rtpEngine.settleTicketBets(bets, winningNumber);

  const perTicket = new Map();
  for (const bet of settled) {
    const acc = perTicket.get(bet.ticketId) || { payout: 0 };
    acc.payout += bet.payoutAmount;
    perTicket.set(bet.ticketId, acc);
  }

  const totalWagered = bets.reduce((sum, b) => sum + b.stake, 0);

  await prisma.$transaction(async (tx) => {
    for (const bet of settled) {
      await tx.ticketBet.update({
        where: { id: bet.id },
        data: { isWinner: bet.isWinner, payoutAmount: bet.payoutAmount },
      });
    }

    for (const [ticketId, acc] of perTicket.entries()) {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: acc.payout > 0 ? 'WON' : 'LOST',
          totalPayout: acc.payout,
          validatedAt: new Date(),
        },
      });
    }

    await tx.rouletteRound.update({
      where: { id: round.id },
      data: { status: 'SETTLED', winningNumber, winningColor, settledAt: new Date() },
    });

    if (totalWagered > 0 || totalPayout > 0) {
      await rtpStats.recordDailyDelta({ shopId: shop.id, wagered: totalWagered, paid: totalPayout, tx });
    }
  });

  emitToShop(io, shop.workCode, 'round:result', {
    roundId: round.id,
    roundNumber: round.roundNumber,
    winningNumber,
    winningColor,
  });
}

async function tick() {
  const shops = await prisma.shop.findMany({ where: { isActive: true } });

  for (const shop of shops) {
    try {
      if (!(await isRouletteActiveForShop(shop.id))) continue;

      const openRoundRow = await prisma.rouletteRound.findFirst({
        where: { shopId: shop.id, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });

      if (!openRoundRow) {
        await openRound(shop);
        continue;
      }

      if (openRoundRow.closesAt <= new Date()) {
        await prisma.rouletteRound.update({ where: { id: openRoundRow.id }, data: { status: 'CLOSED' } });
        emitToShop(io, shop.workCode, 'round:closing', { roundId: openRoundRow.id });
        await settleRound(shop, openRoundRow);
      }
    } catch (err) {
      console.error(`[roundScheduler] Erreur shop ${shop.id}:`, err);
    }
  }
}

function start(socketIoInstance) {
  io = socketIoInstance;
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((err) => console.error('[roundScheduler] tick failed:', err));
  }, TICK_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
