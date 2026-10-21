import { Router, Request, Response } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { STATS_MARKET_TYPES, computeStatsItemResult } from "../../lib/stats-settlement";
import { settleTicket } from "../../services/tpe.service";

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
  // Sans filtre explicite, exclure les matchs terminés/annulés : triés du
  // plus proche au plus lointain (startTime asc), ils remontaient en
  // premier (dates passées = les plus "petites") et reléguaient les matchs
  // à venir en pages suivantes. Toujours accessibles via le filtre de
  // statut pour qui veut les consulter volontairement.
  where.status = status ? status : { notIn: ["FINISHED", "CANCELLED"] };
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

// POST /api/admin/sports/events/:id/settle-stats — règle en masse les
// marchés "statistiques" (mi-temps, corners, cartons) à partir de données
// saisies UNE SEULE FOIS par le trader, au lieu d'une validation sélection
// par sélection, ticket par ticket (voir Tickets TPE). Même calcul que le
// règlement automatique via API-Football (stats-settlement.ts), appliqué à
// toutes les sélections en attente de tous les tickets liés à ce match.
adminSportsRouter.post("/events/:id/settle-stats",
  requireRole("TRADER", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { homeScore, awayScore, htHomeScore, htAwayScore, cornersHome, cornersAway, cardsHome, cardsAway } = req.body;

    let event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) { res.status(404).json({ success: false, error: "Match introuvable" }); return; }

    // Score final : requis pour calculer la 2nde mi-temps (score final -
    // score mi-temps) — on le prend en base, ou on l'enregistre ici si le
    // trader le saisit dans ce même formulaire pour éviter un aller-retour.
    if (homeScore !== undefined && awayScore !== undefined) {
      event = await prisma.event.update({
        where: { id: event.id },
        data: { homeScore: Number(homeScore), awayScore: Number(awayScore), result: `${homeScore}-${awayScore}` },
      });
    }
    if (event.homeScore == null || event.awayScore == null) {
      res.status(400).json({ success: false, error: "Le score final n'est pas encore connu — saisissez-le d'abord." }); return;
    }

    const isValidCount = (v: unknown) => Number.isInteger(Number(v)) && Number(v) >= 0;

    let htHome: number | undefined, htAway: number | undefined;
    if (htHomeScore !== undefined && htAwayScore !== undefined) {
      if (!isValidCount(htHomeScore) || !isValidCount(htAwayScore)) {
        res.status(400).json({ success: false, error: "Score mi-temps invalide" }); return;
      }
      htHome = Number(htHomeScore); htAway = Number(htAwayScore);
      if (htHome > event.homeScore || htAway > event.awayScore) {
        res.status(400).json({ success: false, error: "Le score mi-temps ne peut pas dépasser le score final" }); return;
      }
    }

    let corners: { home: number; away: number } | null = null;
    if (cornersHome !== undefined && cornersAway !== undefined) {
      if (!isValidCount(cornersHome) || !isValidCount(cornersAway)) {
        res.status(400).json({ success: false, error: "Corners invalides" }); return;
      }
      corners = { home: Number(cornersHome), away: Number(cornersAway) };
    }

    let cards: { home: number; away: number } | null = null;
    if (cardsHome !== undefined && cardsAway !== undefined) {
      if (!isValidCount(cardsHome) || !isValidCount(cardsAway)) {
        res.status(400).json({ success: false, error: "Cartons invalides" }); return;
      }
      cards = { home: Number(cardsHome), away: Number(cardsAway) };
    }

    if (htHome === undefined && !corners && !cards) {
      res.status(400).json({ success: false, error: "Renseignez au moins une donnée (mi-temps, corners ou cartons)" }); return;
    }

    const markets = await prisma.market.findMany({
      where: { eventId: event.id, type: { in: STATS_MARKET_TYPES as unknown as string[] } },
      include: { odds: { include: { ticketItems: true } } },
    });

    let updatedItems = 0;
    const touchedTicketIds = new Set<string>();
    for (const market of markets) {
      const isHalfMarket = market.type.includes("HALF");
      const isCornersOrCards = market.type.startsWith("CORNERS") || market.type.startsWith("CARDS");
      if (isHalfMarket && htHome === undefined) continue; // pas de données saisies — laissé pour plus tard
      if (isCornersOrCards && !corners && !cards) continue;

      for (const odd of market.odds) {
        const result = computeStatsItemResult(
          market.type, odd.label, htHome ?? 0, htAway ?? 0, event.homeScore, event.awayScore, corners, cards,
        );
        if (!result) continue;
        for (const item of odd.ticketItems) {
          if (item.result !== null) continue;
          await prisma.ticketItem.update({ where: { id: item.id }, data: { result } });
          updatedItems++;
          touchedTicketIds.add(item.ticketId);
        }
      }
    }

    let settledTickets = 0;
    for (const ticketId of touchedTicketIds) {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { items: true } });
      if (ticket && ticket.status === "PENDING" && ticket.items.every((i) => i.result !== null)) {
        await settleTicket(ticketId);
        settledTickets++;
      }
    }

    res.json({ success: true, data: { updatedItems, settledTickets } });
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
