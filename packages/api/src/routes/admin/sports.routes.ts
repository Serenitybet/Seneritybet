import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminSportsRouter = Router();

adminSportsRouter.get("/events", asyncHandler(async (req: Request, res: Response) => {
  const page  = parseInt((req.query.page  as string) ?? "1",  10);
  const limit = parseInt((req.query.limit as string) ?? "25", 10);

  const [total, events] = await Promise.all([
    prisma.event.count(),
    prisma.event.findMany({
      include: { competition: { include: { sport: true } }, _count: { select: { markets: true } } },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ success: true, data: { events, total, page, limit, totalPages: Math.ceil(total / limit) } });
}));

adminSportsRouter.patch("/markets/:id",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { isSuspended, isActive } = req.body;
    await prisma.market.update({
      where: { id: req.params.id },
      data: {
        ...(isSuspended !== undefined ? { isSuspended } : {}),
        ...(isActive    !== undefined ? { isActive    } : {}),
      },
    });
    res.json({ success: true });
  }),
);

adminSportsRouter.patch("/odds/:id",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { value } = req.body;
    if (!value || isNaN(Number(value))) {
      res.status(400).json({ success: false, error: "Valeur de cote invalide" }); return;
    }
    await prisma.odd.update({ where: { id: req.params.id }, data: { value: Number(value) } });
    res.json({ success: true });
  }),
);

adminSportsRouter.patch("/events/:id/result",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { homeScore, awayScore, status } = req.body;
    await prisma.event.update({
      where: { id: req.params.id },
      data: { homeScore, awayScore, status, result: `${homeScore}-${awayScore}` },
    });
    res.json({ success: true });
  }),
);
