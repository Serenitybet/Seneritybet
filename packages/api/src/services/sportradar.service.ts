import axios from "axios";
import { prisma } from "../lib/prisma";

const API_KEY = process.env.SPORTRADAR_API_KEY;
const BASE    = "https://api.sportradar.com";

// ─── Mapping sports Sportradar → nos slugs internes ──────────────────────────
const SPORTS_CONFIG = [
  {
    slug:        "football",
    icon:        "⚽",
    label:       "Football",
    srSport:     "soccer",
    version:     "v4",
    tournaments: [
      "sr:tournament:17",   // Premier League
      "sr:tournament:679",  // Ligue 1
      "sr:tournament:34",   // Champions League
      "sr:tournament:238",  // La Liga
      "sr:tournament:35",   // Serie A
      "sr:tournament:44",   // Bundesliga
      "sr:tournament:140",  // CAN (Afrique)
      "sr:tournament:68",   // Europa League
    ],
  },
  {
    slug:    "basketball",
    icon:    "🏀",
    label:   "Basketball",
    srSport: "basketball",
    version: "v4",
    tournaments: [
      "sr:tournament:132",  // NBA
      "sr:tournament:4",    // Euroleague
    ],
  },
  {
    slug:    "tennis",
    icon:    "🎾",
    label:   "Tennis",
    srSport: "tennis",
    version: "v3",
    tournaments: [
      "sr:tournament:2",    // Australian Open
      "sr:tournament:12",   // Roland-Garros
    ],
  },
  {
    slug:    "mma",
    icon:    "🥊",
    label:   "MMA",
    srSport: "mma",
    version: "v2",
    tournaments: [],
  },
];

// ─── Sync des événements football depuis Sportradar ───────────────────────────
export async function syncSportradarFootball() {
  if (!API_KEY) {
    console.warn("SPORTRADAR_API_KEY non configurée, sync ignorée");
    return;
  }

  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  for (const date of [today, tomorrow]) {
    try {
      const url = `${BASE}/soccer/trial/v4/en/schedules/${date}/schedule.json`;
      const res = await axios.get(url, { params: { api_key: API_KEY } });

      const sportEvents = res.data?.sport_events ?? [];

      // S'assurer que le sport Football existe en base
      const sport = await prisma.sport.upsert({
        where:  { slug: "football" },
        update: {},
        create: { slug: "football", name: "Football", icon: "⚽", sortOrder: 1 },
      });

      for (const ev of sportEvents) {
        try {
          await upsertSportradarEvent(sport.id, ev);
        } catch (e) {
          // Ignorer les erreurs individuelles
        }
      }
    } catch (err: any) {
      console.error(`Erreur sync Sportradar football ${date}:`, err.message);
    }
  }
}

// ─── Sync matchs en direct ────────────────────────────────────────────────────
export async function syncLiveMatches() {
  if (!API_KEY) return;
  try {
    const url = `${BASE}/soccer/trial/v4/en/schedules/live/schedule.json`;
    const res = await axios.get(url, { params: { api_key: API_KEY } });

    const sport = await prisma.sport.upsert({
      where:  { slug: "football" },
      update: {},
      create: { slug: "football", name: "Football", icon: "⚽", sortOrder: 1 },
    });

    for (const ev of res.data?.sport_events ?? []) {
      await upsertSportradarEvent(sport.id, ev, true);
    }
  } catch (err: any) {
    console.error("Erreur sync live:", err.message);
  }
}

// ─── Upsert d'un événement Sportradar en base ─────────────────────────────────
async function upsertSportradarEvent(sportId: string, ev: any, isLive = false) {
  if (!ev.id || !ev.competitors || ev.competitors.length < 2) return;

  const home = ev.competitors.find((c: any) => c.qualifier === "home");
  const away = ev.competitors.find((c: any) => c.qualifier === "away");
  if (!home || !away) return;

  // Competition
  const tourney = ev.tournament ?? ev.competition;
  let competition = await prisma.competition.findFirst({
    where: { externalId: tourney?.id },
  });
  if (!competition && tourney) {
    competition = await prisma.competition.create({
      data: {
        name:       tourney.name ?? "Compétition",
        slug:       slugify(tourney.name ?? tourney.id),
        country:    tourney.category?.country_code ?? "",
        externalId: tourney.id,
        sportId,
      },
    });
  }
  if (!competition) return;

  const startTime = new Date(ev.start_time ?? ev.scheduled);
  const status    = isLive ? "LIVE" : "UPCOMING";

  const event = await prisma.event.upsert({
    where: { externalId: ev.id },
    update: {
      homeTeam:  home.name,
      awayTeam:  away.name,
      startTime,
      status,
    },
    create: {
      externalId:    ev.id,
      competitionId: competition.id,
      homeTeam:      home.name,
      awayTeam:      away.name,
      startTime,
      status,
    },
  });

  // Cotes : créer/mettre à jour si disponibles
  if (ev.markets) {
    await upsertMarkets(event.id, home.name, away.name, ev.markets);
  }
}

// ─── Sync cotes depuis l'API Odds Comparison ──────────────────────────────────
export async function syncOddsForEvent(sportradarEventId: string) {
  if (!API_KEY) return;
  try {
    const url = `${BASE}/oddscomparison-prematch/trial/v2/en/sport_events/${sportradarEventId}/markets.json`;
    const res = await axios.get(url, { params: { api_key: API_KEY } });

    const event = await prisma.event.findUnique({ where: { externalId: sportradarEventId } });
    if (!event) return;

    const markets = res.data?.markets ?? [];
    await upsertMarkets(event.id, event.homeTeam, event.awayTeam, markets);
  } catch (err: any) {
    // Ignorer les erreurs de cotes
  }
}

// ─── Upsert des marchés et cotes ─────────────────────────────────────────────
async function upsertMarkets(eventId: string, homeTeam: string, awayTeam: string, markets: any[]) {
  for (const m of markets) {
    const marketType = detectMarketType(m.name ?? m.id);
    if (!marketType) continue;

    let market = await prisma.market.findFirst({ where: { eventId, type: marketType } });
    if (!market) {
      market = await prisma.market.create({
        data: { eventId, name: marketLabel(marketType, homeTeam, awayTeam), type: marketType },
      });
    }

    const outcomes = m.outcomes ?? m.books?.[0]?.outcomes ?? [];
    for (const o of outcomes) {
      const label = outcomeLabel(o.name, homeTeam, awayTeam);
      const value = parseFloat(o.odds ?? o.value ?? 0);
      if (!label || value <= 1) continue;

      const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
      if (existing) {
        await prisma.odd.update({ where: { id: existing.id }, data: { value } });
      } else {
        await prisma.odd.create({ data: { marketId: market.id, label, value } });
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectMarketType(name: string): string | null {
  const n = (name ?? "").toLowerCase();
  if (n.includes("3-way") || n.includes("match winner") || n.includes("1x2")) return "MATCH_WINNER";
  if (n.includes("over/under") || n.includes("total goals"))                   return "OVER_UNDER";
  if (n.includes("double chance"))                                              return "DOUBLE_CHANCE";
  if (n.includes("both teams") || n.includes("gg"))                           return "BOTH_TEAMS_SCORE";
  if (n.includes("handicap"))                                                   return "HANDICAP";
  return null;
}

function marketLabel(type: string, home: string, away: string): string {
  switch (type) {
    case "MATCH_WINNER":     return `Résultat : ${home} vs ${away}`;
    case "OVER_UNDER":       return "Plus/Moins de buts";
    case "DOUBLE_CHANCE":    return "Double chance";
    case "BOTH_TEAMS_SCORE": return "Les deux équipes marquent";
    case "HANDICAP":         return "Handicap";
    default:                 return type;
  }
}

function outcomeLabel(name: string, home: string, away: string): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (n === home.toLowerCase() || n === "1" || n === "home") return "1";
  if (n === away.toLowerCase() || n === "2" || n === "away") return "2";
  if (n === "draw" || n === "x"  || n === "tie")             return "X";
  if (n.startsWith("over"))  return `Plus de ${name.split(" ")[1] ?? "2.5"}`;
  if (n.startsWith("under")) return `Moins de ${name.split(" ")[1] ?? "2.5"}`;
  return name;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60);
}

// ─── Sync complète (appelée par le worker BullMQ) ────────────────────────────
export async function syncAllSportradar() {
  console.log("🔄 Sync Sportradar démarrée...");
  await syncSportradarFootball();
  await syncLiveMatches();
  console.log("✅ Sync Sportradar terminée");
}
