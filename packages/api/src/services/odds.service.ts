import axios from "axios";
import { prisma } from "../lib/prisma";

const ODDS_API_BASE = process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY;

// Sports supportés par l'API externe → slug interne
const SPORT_MAPPING: Record<string, string> = {
  "soccer_epl": "premier-league",
  "soccer_uefa_champs_league": "champions-league",
  "soccer_france_ligue_one": "ligue-1",
  "basketball_nba": "nba",
};

export async function syncOddsFromAPI() {
  if (!API_KEY) {
    console.warn("ODDS_API_KEY non configurée, sync ignorée");
    return;
  }

  for (const [apiSport, competitionSlug] of Object.entries(SPORT_MAPPING)) {
    try {
      const response = await axios.get(`${ODDS_API_BASE}/sports/${apiSport}/odds`, {
        params: {
          apiKey: API_KEY,
          regions: "eu",
          markets: "h2h,totals",
          oddsFormat: "decimal",
        },
      });

      const competition = await prisma.competition.findUnique({ where: { slug: competitionSlug } });
      if (!competition) continue;

      for (const game of response.data) {
        await upsertEvent(competition.id, game);
      }
    } catch (err) {
      console.error(`Erreur sync odds pour ${apiSport}:`, err);
    }
  }
}

async function upsertEvent(competitionId: string, game: any) {
  const event = await prisma.event.upsert({
    where: { externalId: game.id },
    update: {
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      startTime: new Date(game.commence_time),
    },
    create: {
      competitionId,
      externalId: game.id,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      startTime: new Date(game.commence_time),
    },
  });

  // Prendre les cotes du premier bookmaker disponible
  const bookmaker = game.bookmakers?.[0];
  if (!bookmaker) return;

  for (const apiMarket of bookmaker.markets) {
    const marketType = apiMarket.key === "h2h" ? "MATCH_WINNER" : "OVER_UNDER";
    const marketName = apiMarket.key === "h2h" ? "Résultat du match" : "Plus/Moins de 2.5 buts";

    let market = await prisma.market.findFirst({ where: { eventId: event.id, type: marketType } });
    if (!market) {
      market = await prisma.market.create({
        data: { eventId: event.id, name: marketName, type: marketType },
      });
    }

    for (const outcome of apiMarket.outcomes) {
      const label = outcome.name === game.home_team ? "1"
        : outcome.name === game.away_team ? "2"
        : outcome.name === "Draw" ? "X"
        : outcome.name; // Over / Under

      const existingOdd = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
      if (existingOdd) {
        await prisma.odd.update({ where: { id: existingOdd.id }, data: { value: outcome.price } });
      } else {
        await prisma.odd.create({ data: { marketId: market.id, label, value: outcome.price } });
      }
    }
  }
}

export async function getUpcomingEvents(sportSlug?: string, page = 1, limit = 20) {
  const now = new Date();

  const competition = sportSlug
    ? await prisma.competition.findFirst({ where: { sport: { slug: sportSlug } }, select: { id: true } })
    : null;

  const [total, events] = await Promise.all([
    prisma.event.count({
      where: {
        startTime: { gte: now },
        status: { in: ["UPCOMING", "LIVE"] },
        ...(competition ? { competitionId: competition.id } : {}),
      },
    }),
    prisma.event.findMany({
      where: {
        startTime: { gte: now },
        status: { in: ["UPCOMING", "LIVE"] },
        ...(competition ? { competitionId: competition.id } : {}),
      },
      include: {
        competition: { include: { sport: true } },
        markets: {
          where: { isActive: true, isSuspended: false },
          include: { odds: { where: { isActive: true } } },
        },
      },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
}
