import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";

export const adminSportsRouter = Router();

// ─── Compétitions ─────────────────────────────────────────────────────────────

adminSportsRouter.get("/competitions", asyncHandler(async (_req: Request, res: Response) => {
  const competitions = await prisma.competition.findMany({
    include: { sport: true },
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  res.json({ success: true, data: competitions });
}));

// ─── Événements ───────────────────────────────────────────────────────────────

adminSportsRouter.get("/events", asyncHandler(async (req: Request, res: Response) => {
  const page   = parseInt((req.query.page  as string) ?? "1",  10);
  const limit  = parseInt((req.query.limit as string) ?? "25", 10);
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { homeTeam: { contains: search, mode: "insensitive" } },
      { awayTeam: { contains: search, mode: "insensitive" } },
      { competition: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: {
        competition: { include: { sport: true } },
        _count: { select: { markets: true } },
      },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ success: true, data: { events, total, page, limit, totalPages: Math.ceil(total / limit) } });
}));

// GET /api/admin/sports/events/:id — détail avec marchés + cotes
adminSportsRouter.get("/events/:id", asyncHandler(async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      competition: { include: { sport: true } },
      markets: {
        include: {
          odds: { orderBy: { label: "asc" } },
          _count: { select: { betItems: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!event) { res.status(404).json({ success: false, error: "Événement introuvable" }); return; }
  res.json({ success: true, data: event });
}));

// POST /api/admin/sports/events — créer un événement manuel
adminSportsRouter.post("/events",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { homeTeam, awayTeam, startTime, competitionId, competitionName, sportName } = req.body;
    if (!homeTeam || !awayTeam || !startTime) {
      res.status(400).json({ success: false, error: "Équipes et date requis" }); return;
    }

    let compId = competitionId as string | undefined;

    if (!compId && competitionName) {
      const sport_name = (sportName as string) ?? "Football";
      let sport = await prisma.sport.findFirst({
        where: { name: { equals: sport_name, mode: "insensitive" } },
      });
      if (!sport) {
        sport = await prisma.sport.create({
          data: { name: sport_name, slug: sport_name.toLowerCase().replace(/\s+/g, "-") },
        });
      }
      const slug = (competitionName as string).toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
      let comp = await prisma.competition.findFirst({
        where: { name: { equals: competitionName as string, mode: "insensitive" } },
      });
      if (!comp) {
        comp = await prisma.competition.create({
          data: { name: competitionName as string, slug, sportId: sport.id },
        });
      }
      compId = comp.id;
    }

    if (!compId) {
      res.status(400).json({ success: false, error: "Compétition requise" }); return;
    }

    const event = await prisma.event.create({
      data: { homeTeam, awayTeam, startTime: new Date(startTime), competitionId: compId },
      include: { competition: { include: { sport: true } }, _count: { select: { markets: true } } },
    });

    res.status(201).json({ success: true, data: event });
  }),
);

// PATCH /api/admin/sports/events/:id/result — saisir le score final
adminSportsRouter.patch("/events/:id/result",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { homeScore, awayScore, status } = req.body;
    await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...(homeScore !== undefined ? { homeScore: Number(homeScore) } : {}),
        ...(awayScore !== undefined ? { awayScore: Number(awayScore) } : {}),
        ...(status    !== undefined ? { status                       } : {}),
        result: homeScore !== undefined && awayScore !== undefined
          ? `${homeScore}-${awayScore}`
          : undefined,
      },
    });
    res.json({ success: true });
  }),
);

// DELETE /api/admin/sports/events/:id
adminSportsRouter.delete("/events/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const bets = await prisma.betItem.count({
      where: { market: { eventId: req.params.id } },
    });
    if (bets > 0) {
      res.status(400).json({ success: false, error: "Impossible de supprimer : des paris existent sur cet événement" });
      return;
    }
    // Cascade : odds → markets → event
    const markets = await prisma.market.findMany({ where: { eventId: req.params.id }, select: { id: true } });
    for (const m of markets) {
      await prisma.odd.deleteMany({ where: { marketId: m.id } });
    }
    await prisma.market.deleteMany({ where: { eventId: req.params.id } });
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }),
);

// ─── Marchés ──────────────────────────────────────────────────────────────────

// POST /api/admin/sports/events/:id/markets — créer un marché avec ses cotes
adminSportsRouter.post("/events/:id/markets",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, type, odds } = req.body;
    if (!name || !type) {
      res.status(400).json({ success: false, error: "Nom et type de marché requis" }); return;
    }
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) { res.status(404).json({ success: false, error: "Événement introuvable" }); return; }

    const market = await prisma.market.create({
      data: {
        eventId: req.params.id,
        name,
        type,
        odds: odds && Array.isArray(odds) && odds.length > 0
          ? { create: odds.map((o: { label: string; value: number }) => ({ label: o.label, value: Number(o.value) })) }
          : undefined,
      },
      include: {
        odds: { orderBy: { label: "asc" } },
        _count: { select: { betItems: true } },
      },
    });

    res.status(201).json({ success: true, data: market });
  }),
);

// PATCH /api/admin/sports/markets/:id — activer/suspendre
adminSportsRouter.patch("/markets/:id",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { isSuspended, isActive, name } = req.body;
    await prisma.market.update({
      where: { id: req.params.id },
      data: {
        ...(isSuspended !== undefined ? { isSuspended } : {}),
        ...(isActive    !== undefined ? { isActive    } : {}),
        ...(name        !== undefined ? { name        } : {}),
      },
    });
    res.json({ success: true });
  }),
);

// DELETE /api/admin/sports/markets/:id
adminSportsRouter.delete("/markets/:id",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const bets = await prisma.betItem.count({ where: { marketId: req.params.id } });
    if (bets > 0) {
      res.status(400).json({ success: false, error: "Impossible : des paris existent sur ce marché" }); return;
    }
    await prisma.odd.deleteMany({ where: { marketId: req.params.id } });
    await prisma.market.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }),
);

// ─── Cotes ────────────────────────────────────────────────────────────────────

// POST /api/admin/sports/markets/:id/odds — ajouter une cote
adminSportsRouter.post("/markets/:id/odds",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { label, value } = req.body;
    if (!label || value === undefined || isNaN(Number(value))) {
      res.status(400).json({ success: false, error: "Label et valeur requis" }); return;
    }
    if (Number(value) < 1.01) {
      res.status(400).json({ success: false, error: "Cote minimale : 1.01" }); return;
    }
    const odd = await prisma.odd.create({
      data: { marketId: req.params.id, label, value: Number(value) },
    });
    res.status(201).json({ success: true, data: odd });
  }),
);

// PATCH /api/admin/sports/odds/:id — modifier une cote
adminSportsRouter.patch("/odds/:id",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { value } = req.body;
    if (value === undefined || isNaN(Number(value))) {
      res.status(400).json({ success: false, error: "Valeur de cote invalide" }); return;
    }
    if (Number(value) < 1.01) {
      res.status(400).json({ success: false, error: "Cote minimale : 1.01" }); return;
    }
    await prisma.odd.update({ where: { id: req.params.id }, data: { value: Number(value) } });
    res.json({ success: true });
  }),
);

// DELETE /api/admin/sports/odds/:id
adminSportsRouter.delete("/odds/:id",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.odd.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }),
);
