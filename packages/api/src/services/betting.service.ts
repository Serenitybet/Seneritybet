import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import type { PlaceBetPayload } from "@serenitybet/shared";

const RISK_MAX_PAYOUT = BigInt(
  parseInt(process.env.RISK_MAX_PAYOUT_XAF ?? "5000000", 10)
);

export async function placeBet(userId: string, payload: PlaceBetPayload) {
  if (payload.selections.length === 0) throw new AppError(400, "Aucune sélection");
  if (payload.stake < 100) throw new AppError(400, "Mise minimale : 1 XAF (100 centimes)");

  const stake = BigInt(payload.stake);

  // Vérifier le solde
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < stake) throw new AppError(400, "Solde insuffisant");

  // Récupérer et valider les cotes
  const oddIds = payload.selections.map((s) => s.oddId);
  const odds = await prisma.odd.findMany({
    where: { id: { in: oddIds }, isActive: true },
    include: { market: { include: { event: true } } },
  });

  if (odds.length !== payload.selections.length) {
    throw new AppError(400, "Une ou plusieurs cotes sont invalides ou suspendues");
  }

  // Vérifier que les cotes n'ont pas changé (protection anti-manipulation)
  for (const selection of payload.selections) {
    const odd = odds.find((o) => o.id === selection.oddId);
    if (!odd) throw new AppError(400, "Cote introuvable");
    if (odd.market.isSuspended) throw new AppError(400, `Marché suspendu : ${odd.market.name}`);
    if (odd.market.event.status !== "UPCOMING" && odd.market.event.status !== "LIVE") {
      throw new AppError(400, `Événement non disponible : ${odd.market.event.homeTeam} vs ${odd.market.event.awayTeam}`);
    }
    const diff = Math.abs(Number(odd.value) - selection.oddValue);
    if (diff > 0.05) throw new AppError(400, "La cote a changé, veuillez revalider votre pari");
  }

  // Calculer le total des cotes et le gain potentiel
  const totalOdds = odds.reduce((acc, o) => acc * Number(o.value), 1);
  const potentialWin = BigInt(Math.floor(Number(stake) * totalOdds));

  // Vérifier le seuil de risque
  const isManualCheck = potentialWin > RISK_MAX_PAYOUT;

  // Transaction atomique : débit + création du pari
  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: stake } },
    });

    await tx.transaction.create({
      data: {
        walletId: updatedWallet.id,
        userId,
        type: "BET_PLACED",
        amount: -stake,
        balanceBefore: wallet.balance,
        balanceAfter: updatedWallet.balance,
        status: "COMPLETED",
      },
    });

    const bet = await tx.bet.create({
      data: {
        userId,
        type: payload.type,
        stake,
        totalOdds,
        potentialWin,
        isManualCheck,
        items: {
          create: payload.selections.map((s) => {
            const odd = odds.find((o) => o.id === s.oddId)!;
            return {
              marketId: s.marketId,
              oddId: s.oddId,
              oddValue: Number(odd.value),
            };
          }),
        },
      },
      include: { items: { include: { market: true, odd: true } } },
    });

    return bet;
  });

  return result;
}

export async function getUserBets(userId: string, page: number, limit: number) {
  const [total, bets] = await Promise.all([
    prisma.bet.count({ where: { userId } }),
    prisma.bet.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            odd: true,
            market: { include: { event: { include: { competition: { include: { sport: true } } } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { bets, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function settleBet(betId: string, adminId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { items: { include: { odd: true, market: { include: { event: true } } } } },
  });
  if (!bet) throw new AppError(404, "Pari introuvable");
  if (bet.status !== "PENDING" && bet.status !== "MANUAL_REVIEW") {
    throw new AppError(400, "Ce pari est déjà réglé");
  }

  // Vérifier que tous les items ont un résultat
  const hasAllResults = bet.items.every((item) => item.result !== null);
  if (!hasAllResults) throw new AppError(400, "Tous les résultats ne sont pas encore disponibles");

  const won = bet.items.every((item) => item.result === "WON");
  const voided = bet.items.every((item) => item.result === "VOID");
  const status = won ? "WON" : voided ? "REFUNDED" : "LOST";

  await prisma.$transaction(async (tx) => {
    await tx.bet.update({
      where: { id: betId },
      data: { status, settledAt: new Date(), isManualCheck: false },
    });

    if (won) {
      const wallet = await tx.wallet.findUnique({ where: { userId: bet.userId } });
      if (!wallet) return;
      await tx.wallet.update({
        where: { userId: bet.userId },
        data: { balance: { increment: bet.potentialWin } },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: bet.userId,
          type: "BET_WON",
          amount: bet.potentialWin,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance + bet.potentialWin,
          status: "COMPLETED",
          betId,
        },
      });
    }

    if (voided) {
      const wallet = await tx.wallet.findUnique({ where: { userId: bet.userId } });
      if (!wallet) return;
      await tx.wallet.update({
        where: { userId: bet.userId },
        data: { balance: { increment: bet.stake } },
      });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: bet.userId,
          type: "BET_REFUND",
          amount: bet.stake,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance + bet.stake,
          status: "COMPLETED",
          betId,
        },
      });
    }
  });

  return { betId, status };
}
