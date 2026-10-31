import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getUpcomingEvents, sortOddsByCanonicalOrder } from "../services/odds.service";
import { asyncHandler } from "../lib/asyncHandler";

export const sportsRouter = Router();

sportsRouter.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const sports = await prisma.sport.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ success: true, data: sports });
}));

sportsRouter.get("/events", asyncHandler(async (req: Request, res: Response) => {
  const sport    = req.query.sport as string | undefined;
  const page     = parseInt((req.query.page  as string) ?? "1",  10);
  const limit    = parseInt((req.query.limit as string) ?? "50", 10);
  const dateFilter = req.query.date as string | undefined; // today | tomorrow | 3days | all
  const league   = req.query.league as string | undefined; // recherche texte libre sur le nom de la compétition

  const result = await getUpcomingEvents(sport, page, Math.min(limit, 200), dateFilter, league);
  res.json({ success: true, data: result });
}));

sportsRouter.get("/events/:id", asyncHandler(async (req: Request, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      competition: { include: { sport: true } },
      markets: {
        where: { isActive: true },
        include: { odds: { where: { isActive: true } } },
      },
    },
  });
  if (!event) {
    res.status(404).json({ success: false, error: "Événement introuvable" });
    return;
  }
  const sorted = { ...event, markets: event.markets.map((m: { type: string; odds: any[] }) => ({ ...m, odds: sortOddsByCanonicalOrder(m.type, m.odds) })) };
  res.json({ success: true, data: sorted });
}));
