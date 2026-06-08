import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getUpcomingEvents } from "../services/odds.service";
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
  const sport = req.query.sport as string | undefined;
  const page  = parseInt((req.query.page  as string) ?? "1",  10);
  const limit = parseInt((req.query.limit as string) ?? "20", 10);
  const result = await getUpcomingEvents(sport, page, Math.min(limit, 50));
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
  res.json({ success: true, data: event });
}));
