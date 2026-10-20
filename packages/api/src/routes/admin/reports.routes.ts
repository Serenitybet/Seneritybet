import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { getCreditsStatus } from "../../lib/credits.state";

export const adminReportsRouter = Router();
adminReportsRouter.use(requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"));

// GET /api/admin/reports/credits — statut crédits TheOddsAPI
adminReportsRouter.get("/credits", asyncHandler(async (_req: Request, res: Response) => {
  const credits = getCreditsStatus();
  const MONTHLY_BUDGET = 100_000;
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed  = now.getDate();
  const expectedUsed = Math.round((daysPassed / daysInMonth) * MONTHLY_BUDGET * 0.56); // budget cible 56K

  res.json({
    success: true,
    data: {
      remaining:     credits.remaining,
      used:          credits.used,
      paused:        credits.paused,
      lastSync:      credits.lastSync,
      monthlyBudget: MONTHLY_BUDGET,
      targetUsage:   56_000,
      periodStart:   start,
      expectedUsedSoFar: expectedUsed,
      status: credits.remaining === null ? "unknown"
        : credits.remaining < 500  ? "critical"
        : credits.remaining < 5000 ? "warning"
        : "ok",
    },
  });
}));

// Tableau de bord recentré sur les tickets physiques (TPE) — l'activité en
// ligne (User/Bet/Transaction) n'est plus le cœur du métier actuellement.
adminReportsRouter.get("/dashboard", asyncHandler(async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6); // 7 jours, aujourd'hui inclus

  const [
    ticketsToday,
    pendingTickets,
    wonUnpaidTickets,
    stakesTodayAgg,
    payoutsTodayAgg,
    tpeCreditAgg,
    activeTpeCount,
    topTpeRaw,
    weekTickets,
  ] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: today } } }),
    prisma.ticket.count({ where: { status: "PENDING", createdAt: { gte: today } } }),
    prisma.ticket.count({ where: { status: "WON" } }),
    prisma.ticket.aggregate({ where: { createdAt: { gte: today } }, _sum: { stake: true } }),
    prisma.ticket.aggregate({ where: { status: "PAID", paidAt: { gte: today } }, _sum: { potentialWin: true } }),
    prisma.tpe.aggregate({ where: { status: "ACTIVE" }, _sum: { credit: true } }),
    prisma.tpe.count({ where: { status: "ACTIVE" } }),
    prisma.ticket.groupBy({
      by: ["tpeId"],
      where: { createdAt: { gte: weekAgo } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true, stake: true },
    }),
  ]);

  const topTpeInfo = await prisma.tpe.findMany({
    where: { id: { in: topTpeRaw.map((t: { tpeId: string }) => t.tpeId) } },
    select: { id: true, code: true, name: true },
  });
  const topTpe = topTpeRaw.map((t: { tpeId: string; _count: { id: number } }) => {
    const info = topTpeInfo.find((i: { id: string }) => i.id === t.tpeId);
    return { code: info?.code ?? "—", name: info?.name ?? null, ticketCount: t._count.id };
  });

  // Mises par jour (XAF, pas centimes) — 7 derniers jours, bucketing en JS
  // (jeu de données TPE assez restreint pour ne pas justifier du SQL brut).
  const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const chartMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekAgo); d.setDate(d.getDate() + i);
    chartMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const t of weekTickets) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (chartMap.has(key)) chartMap.set(key, (chartMap.get(key) ?? 0) + Number(t.stake) / 100);
  }
  const chart = [...chartMap.entries()].map(([dateStr, stakesXAF]) => ({
    day: DAY_LABELS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()],
    stakesXAF,
  }));

  // Montants en centimes (formatXAF, côté front, attend des centimes).
  const stakesToday  = Number(stakesTodayAgg._sum.stake ?? 0);
  const payoutsToday = Number(payoutsTodayAgg._sum.potentialWin ?? 0);
  const ggrToday     = stakesToday - payoutsToday;
  const marginPct    = stakesToday > 0 ? Math.round((ggrToday / stakesToday) * 1000) / 10 : 0;

  res.json({
    success: true,
    data: {
      tickets: { today: ticketsToday, pending: pendingTickets, wonUnpaid: wonUnpaidTickets },
      finance: { stakesToday, payoutsToday, ggrToday, marginPct },
      tpe: {
        totalCredit: Number(tpeCreditAgg._sum.credit ?? 0), // centimes
        activeCount: activeTpeCount,
        topTpe,
      },
      chart,
    },
  });
}));

adminReportsRouter.get("/financial", asyncHandler(async (req: Request, res: Response) => {
  const from = new Date((req.query.from as string) ?? new Date().toISOString().slice(0, 10));
  const to   = new Date((req.query.to   as string) ?? new Date().toISOString().slice(0, 10));
  to.setHours(23, 59, 59, 999);

  const transactions = await prisma.transaction.groupBy({
    by: ["type"],
    where: { status: "COMPLETED", createdAt: { gte: from, lte: to } },
    _sum:   { amount: true },
    _count: { id: true },
  });

  res.json({ success: true, data: { from, to, transactions } });
}));
