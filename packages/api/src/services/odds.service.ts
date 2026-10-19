import axios from "axios";
import { prisma } from "../lib/prisma";
import { updateCredits } from "../lib/credits.state";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY;

// Sports TheOddsAPI → slug interne + métadonnées
//
// Les 17 championnats ci-dessous sont ceux ciblés par Serenitybet (Tchad),
// confirmés disponibles via GET https://api.the-odds-api.com/v4/sports
// (vérifié le 19/10/2026). Deux championnats visés ne sont PAS couverts par
// TheOddsAPI et ne peuvent donc pas être synchronisés : République Tchèque
// et Égypte (aucune clé correspondante dans leur catalogue).
const SPORTS_CONFIG = [
  // ⚽ Football — les 17 championnats ciblés disponibles chez TheOddsAPI
  { key: "soccer_epl",                           slug: "football", name: "Premier League",       country: "England",      icon: "⚽", sortOrder: 1 }, // 1. Angleterre
  { key: "soccer_france_ligue_one",              slug: "football", name: "Ligue 1",              country: "France",       icon: "⚽", sortOrder: 1 }, // 2. France
  { key: "soccer_italy_serie_a",                 slug: "football", name: "Serie A",              country: "Italy",        icon: "⚽", sortOrder: 1 }, // 3. Italie
  { key: "soccer_germany_bundesliga",            slug: "football", name: "Bundesliga",           country: "Germany",      icon: "⚽", sortOrder: 1 }, // 4. Allemagne
  { key: "soccer_netherlands_eredivisie",        slug: "football", name: "Eredivisie",           country: "Netherlands",  icon: "⚽", sortOrder: 1 }, // 5. Pays-Bas
  { key: "soccer_spl",                           slug: "football", name: "Scottish Premiership",  country: "Scotland",     icon: "⚽", sortOrder: 1 }, // 6. Écosse
  { key: "soccer_norway_eliteserien",            slug: "football", name: "Eliteserien",          country: "Norway",       icon: "⚽", sortOrder: 1 }, // 7. Norvège
  { key: "soccer_saudi_arabia_pro_league",       slug: "football", name: "Saudi Pro League",     country: "Saudi Arabia", icon: "⚽", sortOrder: 1 }, // 9. Arabie Saoudite
  { key: "soccer_turkey_super_league",           slug: "football", name: "Süper Lig",            country: "Turkey",       icon: "⚽", sortOrder: 1 }, // 11. Turquie
  { key: "soccer_belgium_first_div",             slug: "football", name: "Jupiler Pro League",   country: "Belgium",      icon: "⚽", sortOrder: 1 }, // 12. Belgique
  { key: "soccer_switzerland_superleague",       slug: "football", name: "Super League",         country: "Switzerland",  icon: "⚽", sortOrder: 1 }, // 13. Suisse
  { key: "soccer_portugal_primeira_liga",        slug: "football", name: "Primeira Liga",        country: "Portugal",     icon: "⚽", sortOrder: 1 }, // 14. Portugal
  { key: "soccer_russia_premier_league",         slug: "football", name: "Premier Liga",         country: "Russia",       icon: "⚽", sortOrder: 1 }, // 15. Russie
  { key: "soccer_uefa_champs_league",            slug: "football", name: "Champions League",     country: "Europe",       icon: "⚽", sortOrder: 1 }, // 17. Ligue des Champions
  { key: "soccer_uefa_europa_league",            slug: "football", name: "Europa League",        country: "Europe",       icon: "⚽", sortOrder: 1 }, // 18. Europa League
  { key: "soccer_uefa_europa_conference_league", slug: "football", name: "Conference League",    country: "Europe",       icon: "⚽", sortOrder: 1 }, // 19. Conference League
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

// ─── Marchés additionnels (BTTS, double chance) — tous les championnats ───────
//
// Ces marchés ne sont disponibles que via l'endpoint par match (pas par
// championnat), donc 1 appel = 1 match au lieu de 1 appel = 1 championnat.
// Pour maîtriser les crédits : limité aux matchs des 48 prochaines heures,
// plafonné à 60 matchs par exécution (toutes les 2h), récupéré une seule
// fois par match (pas de rafraîchissement répété comme pour les marchés
// principaux). Les crédits utilisés/restants sont loggés à chaque sync
// (voir lib/credits.state) — à surveiller : si la couverture des 17
// championnats devient trop lente ou que le budget mensuel est dépassé,
// augmenter EXTRA_MARKETS_LIMIT ou passer sur un palier TheOddsAPI supérieur.
const SPORT_KEY_BY_COMPETITION_NAME: Record<string, string> = Object.fromEntries(
  SPORTS_CONFIG.map((c) => [c.name, c.key]),
);
const EXTRA_MARKETS_LIMIT = 60;

export async function syncExtraMarkets() {
  if (!API_KEY) return;

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() + 48);

  const events = await prisma.event.findMany({
    where: {
      status: { in: ["UPCOMING", "LIVE"] },
      startTime: { gte: new Date(), lte: cutoff },
      competition: { name: { in: Object.keys(SPORT_KEY_BY_COMPETITION_NAME) } },
      markets: { none: { type: "BOTH_TEAMS_SCORE" } },
    },
    include: { competition: true },
    take: EXTRA_MARKETS_LIMIT,
  });

  let synced = 0;
  for (const event of events) {
    const sportKey = SPORT_KEY_BY_COMPETITION_NAME[event.competition.name];
    if (!sportKey || !event.externalId) continue;

    try {
      const res = await axios.get(
        `${ODDS_API_BASE}/sports/${sportKey}/events/${event.externalId}/odds`,
        {
          params: {
            apiKey:     API_KEY,
            regions:    "eu",
            markets:    "btts,double_chance",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertExtraMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? []);
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422 (pas de données additionnelles pour ce match) ou autre erreur : on ignore et on continue
    }
  }

  if (synced > 0) console.log(`🎯 Marchés additionnels (BTTS, double chance) : ${synced} match(s) synchronisés`);
}

async function upsertExtraMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[]) {
  const bookmaker = bookmakers?.find((b: any) =>
    ["bet365", "unibet", "betway", "onexbet", "pinnacle"].includes(b.key)
  ) ?? bookmakers?.[0];
  if (!bookmaker) return;

  for (const apiMarket of bookmaker.markets) {
    const marketType =
      apiMarket.key === "btts"          ? "BOTH_TEAMS_SCORE" :
      apiMarket.key === "double_chance" ? "DOUBLE_CHANCE"    : null;
    if (!marketType) continue;

    const marketName =
      apiMarket.key === "btts" ? "Les deux équipes marquent"
        : `Double chance : ${homeTeam} vs ${awayTeam}`;

    let market = await prisma.market.findFirst({ where: { eventId, type: marketType as any } });
    if (!market) {
      market = await prisma.market.create({ data: { eventId, name: marketName, type: marketType as any } });
    }

    for (const outcome of apiMarket.outcomes) {
      const label =
        apiMarket.key === "btts"
          ? (outcome.name === "Yes" ? "Oui" : "Non")
          : outcome.name === `${homeTeam} or Draw`      ? "1X"
          : outcome.name === `${awayTeam} or Draw`      ? "X2"
          : outcome.name === `${homeTeam} or ${awayTeam}` ? "12"
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
  } else if (dateFilter === "week") {
    dateFrom = new Date(now);
    dateTo   = new Date(now); dateTo.setDate(now.getDate() + 7); dateTo.setHours(23, 59, 59, 999);
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
