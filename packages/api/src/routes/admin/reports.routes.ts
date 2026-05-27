import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminReportsRouter = Router();
adminReportsRouter.use(requireRole("ADMIN", "SUPER_ADMIN", "FINANCE"));

adminReportsRouter.get("/dashboard", asyncHandler(async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeToday,
    totalBetsToday,
    pendingBets,
    manualReviewBets,
    depositsToday,
    withdrawalsToday,
    grossRevenue,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "PLAYER" } }),
    prisma.user.count({ where: { role: "PLAYER", updatedAt: { gte: today } } }),
    prisma.bet.count({ where: { createdAt: { gte: today } } }),
    prisma.bet.count({ where: { status: "PENDING" } }),
    prisma.bet.count({ where: { isManualCheck: true, status: { in: ["PENDING", "MANUAL_REVIEW"] } } }),
    prisma.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "WITHDRAWAL", status: { in: ["PENDING", "COMPLETED"] }, createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: { in: ["BET_PLACED", "BET_WON"] }, status: "COMPLETED" },
      _sum: { amount: true },
    }),
  ]);

  res.json({
    success: true,
    data: {
      users:   { total: totalUsers, activeToday },
      bets:    { today: totalBetsToday, pending: pendingBets, manualReview: manualReviewBets },
      finance: {
        depositsToday:    Number(depositsToday._sum.amount ?? 0),
        withdrawalsToday: Math.abs(Number(withdrawalsToday._sum.amount ?? 0)),
        grossRevenue:     Number(grossRevenue._sum.amount ?? 0),
      },
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
