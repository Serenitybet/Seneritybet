import { Router, Request, Response } from "express";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { getUpcomingEvents } from "../services/odds.service";
import { syncSportradarFootball } from "../services/sportradar.service";
import { asyncHandler } from "../lib/asyncHandler";

export const sportsRouter = Router();

// Endpoint de diagnostic Sportradar (temporaire)
sportsRouter.get("/sr-test", asyncHandler(async (_req: Request, res: Response) => {
  const key = process.env.SPORTRADAR_API_KEY;
  if (!key) { res.json({ error: "SPORTRADAR_API_KEY manquante" }); return; }

  const results: Record<string, any> = {};

  // Test 1: Tournaments list
  try {
    const r = await axios.get(`https://api.sportradar.com/soccer/trial/v4/en/tournaments.json`, { params: { api_key: key } });
    results.tournaments = { status: r.status, count: r.data?.tournaments?.length ?? 0, sample: r.data?.tournaments?.slice(0, 3) };
  } catch (e: any) { results.tournaments = { error: e.response?.status + " " + e.message }; }

  // Test 2: Premier League schedule
  try {
    const r = await axios.get(`https://api.sportradar.com/soccer/trial/v4/en/tournaments/sr:tournament:17/schedule.json`, { params: { api_key: key } });
    const events = r.data?.tournament_schedule?.sport_events ?? r.data?.sport_events ?? [];
    results.premierLeague = { status: r.status, eventCount: events.length, sample: events.slice(0, 2) };
  } catch (e: any) { results.premierLeague = { error: e.response?.status + " " + e.message }; }

  // Test 3: Live schedule
  try {
    const r = await axios.get(`https://api.sportradar.com/soccer/trial/v4/en/schedules/live/schedule.json`, { params: { api_key: key } });
    results.live = { status: r.status, count: r.data?.sport_events?.length ?? 0 };
  } catch (e: any) { results.live = { error: e.response?.status + " " + e.message }; }

  res.json({ key_preview: key.slice(0, 8) + "...", results });
}));

sportsRouter.get("/sr-sync", asyncHandler(async (_req: Request, res: Response) => {
  await syncSportradarFootball();
  const count = await prisma.event.count({ where: { status: { in: ["UPCOMING", "LIVE"] } } });
  res.json({ success: true, eventsInDB: count });
}));

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
