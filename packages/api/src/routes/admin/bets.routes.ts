import { Router, Request, Response } from "express";
import { requireRole, AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { settleBet } from "../../services/betting.service";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminBetsRouter = Router();

adminBetsRouter.get("/", asyncHandler(async (req: Request, res: Response) => {
  const page       = parseInt((req.query.page   as string) ?? "1",  10);
  const limit      = parseInt((req.query.limit  as string) ?? "25", 10);
  const status     = req.query.status as string | undefined;
  const manualOnly = req.query.manual === "true";

  const where = {
    ...(status     ? { status: status as any }    : {}),
    ...(manualOnly ? { isManualCheck: true }       : {}),
  };

  const [total, bets] = await Promise.all([
    prisma.bet.count({ where }),
    prisma.bet.findMany({
      where,
      include: {
        user:  { select: { id: true, email: true, firstName: true, lastName: true } },
        items: { include: { odd: true, market: { include: { event: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ success: true, data: { bets, total, page, limit, totalPages: Math.ceil(total / limit) } });
}));

adminBetsRouter.post("/:id/settle",
  requireRole("ADMIN", "SUPER_ADMIN", "TRADER"),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await settleBet(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  }),
);

adminBetsRouter.patch("/:id/result",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { itemId, result } = req.body;
    if (!["WON", "LOST", "VOID"].includes(result)) {
      res.status(400).json({ success: false, error: "Résultat invalide" }); return;
    }
    await prisma.betItem.update({ where: { id: itemId }, data: { result } });
    res.json({ success: true });
  }),
);
