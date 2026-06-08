import axios from "axios";
import { prisma } from "../lib/prisma";
import { updateCredits } from "../lib/credits.state";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY;

// Sports TheOddsAPI → slug interne + métadonnées
const SPORTS_CONFIG = [
  // ⚽ Football — Ligues européennes (saison sept-mai)
  { key: "soccer_epl",                      slug: "football", name: "Premier League",          country: "England",   icon: "⚽", sortOrder: 1 },
  { key: "soccer_uefa_champs_league",       slug: "football", name: "Champions League",        country: "Europe",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_france_ligue_one",         slug: "football", name: "Ligue 1",                 country: "France",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_spain_la_liga",            slug: "football", name: "La Liga",                 country: "Spain",     icon: "⚽", sortOrder: 1 },
  { key: "soccer_italy_serie_a",            slug: "football", name: "Serie A",                 country: "Italy",     icon: "⚽", sortOrder: 1 },
  { key: "soccer_germany_bundesliga",       slug: "football", name: "Bundesliga",              country: "Germany",   icon: "⚽", sortOrder: 1 },
  { key: "soccer_uefa_europa_league",       slug: "football", name: "Europa League",           country: "Europe",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_africa_cup_of_nations",    slug: "football", name: "CAN",                     country: "Africa",    icon: "⚽", sortOrder: 1 },
  // ⚽ Football — Ligues actives toute l'année
  { key: "soccer_brazil_campeonato",        slug: "football", name: "Brasileirão",             country: "Brazil",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_argentina_primera_div",   slug: "football", name: "Primera División",        country: "Argentina", icon: "⚽", sortOrder: 1 },
  { key: "soccer_conmebol_copa_libertadores", slug: "football", name: "Copa Libertadores",    country: "South America", icon: "⚽", sortOrder: 1 },
  { key: "soccer_usa_mls",                  slug: "football", name: "MLS",                     country: "USA",       icon: "⚽", sortOrder: 1 },
  { key: "soccer_mexico_ligamx",            slug: "football", name: "Liga MX",                 country: "Mexico",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_japan_j_league",           slug: "football", name: "J-League",                country: "Japan",     icon: "⚽", sortOrder: 1 },
  { key: "soccer_turkey_super_league",      slug: "football", name: "Süper Lig",               country: "Turkey",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_australia_aleague",        slug: "football", name: "A-League",                country: "Australia", icon: "⚽", sortOrder: 1 },
  { key: "soccer_netherlands_eredivisie",   slug: "football", name: "Eredivisie",              country: "Netherlands", icon: "⚽", sortOrder: 1 },
  { key: "soccer_portugal_primeira_liga",   slug: "football", name: "Primeira Liga",           country: "Portugal",  icon: "⚽", sortOrder: 1 },
  // 🏀 Basketball
  { key: "basketball_nba",               slug: "basketball", name: "NBA",                   country: "USA",      icon: "🏀", sortOrder: 2 },
  { key: "basketball_euroleague",        slug: "basketball", name: "Euroleague",             country: "Europe",   icon: "🏀", sortOrder: 2 },
  // 🎾 Tennis
  { key: "tennis_atp_french_open",       slug: "tennis",     name: "Roland Garros",         country: "France",   icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_wimbledon",         slug: "tennis",     name: "Wimbledon",             country: "England",  icon: "🎾", sortOrder: 3 },
  // 🏒 Ice Hockey
  { key: "icehockey_nhl",               slug: "hockey",     name: "NHL",                   country: "USA",      icon: "🏒", sortOrder: 4 },
  // 🏈 American Football
  { key: "americanfootball_nfl",        slug: "american-football", name: "NFL",            country: "USA",      icon: "🏈", sortOrder: 5 },
  // 🥊 MMA
  { key: "mma_mixed_martial_arts",      slug: "mma",        name: "MMA",                   country: "World",    icon: "🥊", sortOrder: 6 },
  // ⚾ Baseball
  { key: "baseball_mlb",               slug: "baseball",   name: "MLB",                   country: "USA",      icon: "⚾", sortOrder: 7 },
];

export async function syncOddsFromAPI() {
  if (!API_KEY) {
    console.warn("ODDS_API_KEY non configurée, sync ignorée");
    return;
  }

  let totalEvents = 0;
  let creditsUsedThisSync = 0;

  for (const config of SPORTS_CONFIG) {
    try {
      const res = await axios.get(`${ODDS_API_BASE}/sports/${config.key}/odds`, {
        params: {
          apiKey:      API_KEY,
          regions:     "eu",
          markets:     "h2h,totals,spreads", // 3 marchés — 1 crédit par appel (indépendant du nb marchés)
          oddsFormat:  "decimal",
          dateFormat:  "iso",
        },
        timeout: 10000,
      });

      // ── Suivi crédits (headers TheOddsAPI) ───────────────────────────────────
      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      const used      = parseInt(res.headers["x-requests-used"]      ?? "0",  10);
      if (remaining >= 0) {
        updateCredits(remaining);
        creditsUsedThisSync++;
      }
      if (used > 0 && creditsUsedThisSync === 1) {
        console.log(`📊 TheOddsAPI — crédits utilisés: ${used} | restants: ${remaining}`);
      }

      if (!res.data || res.data.length === 0) continue;

      // Upsert sport
      const sport = await prisma.sport.upsert({
        where:  { slug: config.slug },
        update: {},
        create: { slug: config.slug, name: getSportLabel(config.slug), icon: config.icon, sortOrder: config.sortOrder },
      });

      // Upsert compétition
      const competition = await prisma.competition.upsert({
        where:  { slug: config.name.toLowerCase().replace(/\s+/g, "-") },
        update: { name: config.name },
        create: {
          name:    config.name,
          slug:    config.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          country: config.country,
          sportId: sport.id,
        },
      });

      // Upsert événements
      for (const game of res.data) {
        await upsertEvent(competition.id, game, config.slug);
        totalEvents++;
      }
    } catch (err: any) {
      if (err.response?.status === 422) continue; // Sport pas disponible
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // Ignorer silencieusement les autres erreurs
    }
  }

  if (totalEvents > 0) console.log(`📅 TheOddsAPI: ${totalEvents} événements synchronisés`);
}

async function upsertEvent(competitionId: string, game: any, sportSlug = "football") {
  const event = await prisma.event.upsert({
    where:  { externalId: game.id },
    update: {
      homeTeam:  game.home_team,
      awayTeam:  game.away_team,
      startTime: new Date(game.commence_time),
    },
    create: {
      competitionId,
      externalId: game.id,
      homeTeam:   game.home_team,
      awayTeam:   game.away_team,
      startTime:  new Date(game.commence_time),
      status:     "UPCOMING",
    },
  });

  // Prendre les cotes du meilleur bookmaker EU disponible
  const bookmaker = game.bookmakers?.find((b: any) =>
    ["bet365", "unibet", "betway", "1xbet", "pinnacle"].includes(b.key)
  ) ?? game.bookmakers?.[0];

  if (!bookmaker) return;

  for (const apiMarket of bookmaker.markets) {
    const marketType =
      apiMarket.key === "h2h"     ? "MATCH_WINNER" :
      apiMarket.key === "spreads" ? "HANDICAP"      : "OVER_UNDER";

    const ouLabel = sportSlug === "football"   ? "Plus/Moins de 2.5 buts"
      : sportSlug === "basketball" ? "Plus/Moins de points"
      : sportSlug === "baseball"   ? "Plus/Moins de points"
      : "Plus/Moins";

    const marketName =
      apiMarket.key === "h2h"     ? `Résultat : ${game.home_team} vs ${game.away_team}` :
      apiMarket.key === "spreads" ? "Handicap asiatique" :
      ouLabel;

    let market = await prisma.market.findFirst({ where: { eventId: event.id, type: marketType } });
    if (!market) {
      market = await prisma.market.create({ data: { eventId: event.id, name: marketName, type: marketType } });
    }

    for (const outcome of apiMarket.outcomes) {
      const label = outcome.name === game.home_team ? "1"
        : outcome.name === game.away_team ? "2"
        : outcome.name === "Draw" ? "X"
        : outcome.name;

      const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
      if (existing) {
        await prisma.odd.update({ where: { id: existing.id }, data: { value: outcome.price } });
      } else {
        await prisma.odd.create({ data: { marketId: market.id, label, value: outcome.price } });
      }
    }
  }
}

function getSportLabel(slug: string): string {
  const labels: Record<string, string> = {
    "football":         "Football",
    "basketball":       "Basketball",
    "tennis":           "Tennis",
    "hockey":           "Hockey sur glace",
    "american-football":"Football Américain",
    "mma":              "MMA / Boxe",
    "baseball":         "Baseball",
  };
  return labels[slug] ?? slug;
}

export async function getUpcomingEvents(sportSlug?: string, page = 1, limit = 50, dateFilter?: string) {
  const now = new Date();

  // ── Filtre de date ────────────────────────────────────────────────────────────
  let dateFrom = now;
  let dateTo: Date | undefined;

  if (dateFilter === "today") {
    dateFrom = new Date(now); dateFrom.setHours(0, 0, 0, 0);
    dateTo   = new Date(now); dateTo.setHours(23, 59, 59, 999);
  } else if (dateFilter === "tomorrow") {
    dateFrom = new Date(now); dateFrom.setDate(now.getDate() + 1); dateFrom.setHours(0, 0, 0, 0);
    dateTo   = new Date(dateFrom);                                  dateTo.setHours(23, 59, 59, 999);
  } else if (dateFilter === "3days") {
    dateFrom = new Date(now);
    dateTo   = new Date(now); dateTo.setDate(now.getDate() + 3); dateTo.setHours(23, 59, 59, 999);
  }

  const where = {
    startTime: { gte: dateFrom, ...(dateTo ? { lte: dateTo } : {}) },
    status:    { in: ["UPCOMING" as const, "LIVE" as const] },
    ...(sportSlug ? {
      competition: { sport: { slug: sportSlug } },
    } : {}),
  };

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: {
        competition: { include: { sport: true } },
        markets: {
          where: { isActive: true, isSuspended: false },
          include: { odds: { where: { isActive: true } } },
        },
      },
      orderBy: [{ status: "asc" }, { startTime: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
}
