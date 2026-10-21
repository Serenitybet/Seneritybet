import axios from "axios";
import { prisma } from "../lib/prisma";
import { canMakeApiFootballRequest, recordApiFootballRequest } from "../lib/api-football.state";
import { settleTicket } from "./tpe.service";

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_DAILY_LIMIT = parseInt(process.env.API_FOOTBALL_DAILY_LIMIT ?? "100", 10);

// Marchés que TheOddsAPI (score final uniquement, via /scores) ne peut pas
// régler — mi-temps (nécessite le score à la pause), corners et cartons
// (stats absentes de TheOddsAPI). Voir computeItemResult dans odds.service.ts
// pour les marchés déjà réglés automatiquement à partir du score final seul.
const STATS_MARKET_TYPES = [
  "FIRST_HALF_WINNER", "SECOND_HALF_WINNER",
  "FIRST_HALF_TOTALS", "FIRST_HALF_HANDICAP", "FIRST_HALF_DOUBLE_CHANCE",
  "SECOND_HALF_TOTALS", "SECOND_HALF_HANDICAP", "SECOND_HALF_DOUBLE_CHANCE",
  "CORNERS_TOTAL", "CORNERS_HANDICAP", "CARDS_TOTAL", "CARDS_HANDICAP",
] as const;

// Le forfait gratuit (100 req/jour) limite aussi le DÉBIT, pas seulement le
// quota journalier — un test manuel du 21/10/2026 a déclenché un 429 "Too
// Many Requests" après une dizaine d'appels rapprochés. On espace donc les
// appels et on plafonne le nombre d'évènements traités par cycle.
const MAX_EVENTS_PER_RUN = 5;
const REQUEST_DELAY_MS = 700;
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|cfc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Correspondance volontairement prudente : mieux vaut laisser un match en
// réglage manuel que de le régler avec les données d'un AUTRE match à cause
// d'un faux positif de rapprochement de nom d'équipe entre les deux API.
function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const longer = na.length >= nb.length ? na : nb;
  const shorter = na.length >= nb.length ? nb : na;
  return longer.includes(shorter) && shorter.length >= longer.length * 0.6;
}

async function apiFootballGet(path: string, params: Record<string, string | number>): Promise<any> {
  if (!canMakeApiFootballRequest(API_FOOTBALL_DAILY_LIMIT)) {
    throw new Error("API_FOOTBALL_QUOTA_EXHAUSTED");
  }
  recordApiFootballRequest();
  const res = await axios.get(`${API_FOOTBALL_BASE}${path}`, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY! },
    params,
    timeout: 10000,
  });
  return res.data;
}

// Les listes de matchs par date sont mises en cache en mémoire pour la durée
// d'un cycle : plusieurs évènements à régler partagent souvent la même date,
// pas la peine de refaire le même appel /fixtures pour chacun (le quota
// gratuit est trop serré pour le gaspiller).
const fixturesByDateCache = new Map<string, any[]>();
async function getFixturesForDate(day: string): Promise<any[]> {
  if (fixturesByDateCache.has(day)) return fixturesByDateCache.get(day)!;
  const data = await apiFootballGet("/fixtures", { date: day, status: "FT" });
  const list = data.response ?? [];
  fixturesByDateCache.set(day, list);
  return list;
}

// Le coup d'envoi peut basculer sur le jour précédent/suivant selon le
// fuseau horaire utilisé par chaque fournisseur — on regarde J, J-1, J+1.
async function findFixture(event: { homeTeam: string; awayTeam: string; startTime: Date }): Promise<any | null> {
  for (const offset of [0, -1, 1]) {
    const d = new Date(event.startTime);
    d.setUTCDate(d.getUTCDate() + offset);
    const day = d.toISOString().slice(0, 10);
    const list = await getFixturesForDate(day);
    const found = list.find((f: any) =>
      teamsMatch(f.teams.home.name, event.homeTeam) && teamsMatch(f.teams.away.name, event.awayTeam),
    );
    if (found) return found;
  }
  return null;
}

function extractCornersCards(
  statsResponse: any[], homeTeam: string, awayTeam: string,
): { corners: { home: number; away: number } | null; cards: { home: number; away: number } | null } {
  if (!statsResponse || statsResponse.length < 2) return { corners: null, cards: null };

  const homeStats = statsResponse.find((t: any) => teamsMatch(t.team.name, homeTeam));
  const awayStats = statsResponse.find((t: any) => teamsMatch(t.team.name, awayTeam));
  if (!homeStats || !awayStats) return { corners: null, cards: null };

  const statValue = (teamStats: any, type: string): number | null => {
    const s = teamStats.statistics?.find((s: any) => s.type?.toLowerCase() === type.toLowerCase());
    const v = s?.value;
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "") return parseInt(v, 10);
    return null;
  };

  let corners: { home: number; away: number } | null = null;
  const hc = statValue(homeStats, "Corner Kicks");
  const ac = statValue(awayStats, "Corner Kicks");
  if (hc !== null && ac !== null) corners = { home: hc, away: ac };

  let cards: { home: number; away: number } | null = null;
  const hy = statValue(homeStats, "Yellow Cards");
  const ay = statValue(awayStats, "Yellow Cards");
  if (hy !== null || ay !== null) {
    const hr = statValue(homeStats, "Red Cards") ?? 0;
    const ar = statValue(awayStats, "Red Cards") ?? 0;
    cards = { home: (hy ?? 0) + hr, away: (ay ?? 0) + ar };
  }

  return { corners, cards };
}

// ─── Calcul du résultat ─────────────────────────────────────────────────────
// Même logique que computeItemResult (odds.service.ts), mais appliquée à des
// paires domicile/extérieur différentes selon le marché (score mi-temps,
// score 2nde mi-temps dérivé, corners, cartons) au lieu du score final du
// match. Dupliquée volontairement plutôt que refactorée dans la fonction
// existante : odds.service.ts règle déjà de l'argent réel en production,
// aucune prise de risque sur ce code éprouvé pour cette extension.
function totalsResult(label: string, total: number): "WON" | "LOST" | "VOID" | null {
  const m = label.match(/^(Plus|Moins)\s+([\d.]+)/); // tolère un éventuel suffixe (" corners"/" cartons")
  if (!m) return null;
  const line = parseFloat(m[2]);
  if (total === line) return "VOID"; // ligne entière atteinte pile — remboursé
  return (m[1] === "Plus") === (total > line) ? "WON" : "LOST";
}

function handicapResult(label: string, homeVal: number, awayVal: number): "WON" | "LOST" | "VOID" | null {
  const m = label.match(/^([12])\s*\(([+-]?[\d.]+)\)$/);
  if (!m) return null;
  const side = m[1];
  const point = parseFloat(m[2]);
  const ownVal = side === "1" ? homeVal : awayVal;
  const oppVal = side === "1" ? awayVal : homeVal;
  const adjusted = ownVal + point;
  if (adjusted === oppVal) return "VOID"; // push — remboursé
  return adjusted > oppVal ? "WON" : "LOST";
}

function doubleChanceResult(label: string, homeVal: number, awayVal: number): "WON" | "LOST" | null {
  const homeOrDraw = homeVal >= awayVal;
  const awayOrDraw = awayVal >= homeVal;
  const notDraw    = homeVal !== awayVal;
  const won = label === "1X" ? homeOrDraw : label === "X2" ? awayOrDraw : label === "12" ? notDraw : null;
  return won === null ? null : won ? "WON" : "LOST";
}

function winnerResult(label: string, homeVal: number, awayVal: number): "WON" | "LOST" {
  const winner = homeVal > awayVal ? "1" : awayVal > homeVal ? "2" : "X";
  return label === winner ? "WON" : "LOST";
}

function computeStatsItemResult(
  marketType: string, label: string,
  htHome: number, htAway: number, ftHome: number, ftAway: number,
  corners: { home: number; away: number } | null,
  cards:   { home: number; away: number } | null,
): "WON" | "LOST" | "VOID" | null {
  const shHome = ftHome - htHome;
  const shAway = ftAway - htAway;
  switch (marketType) {
    case "FIRST_HALF_WINNER":         return winnerResult(label, htHome, htAway);
    case "SECOND_HALF_WINNER":        return winnerResult(label, shHome, shAway);
    case "FIRST_HALF_DOUBLE_CHANCE":  return doubleChanceResult(label, htHome, htAway);
    case "SECOND_HALF_DOUBLE_CHANCE": return doubleChanceResult(label, shHome, shAway);
    case "FIRST_HALF_TOTALS":         return totalsResult(label, htHome + htAway);
    case "SECOND_HALF_TOTALS":        return totalsResult(label, shHome + shAway);
    case "FIRST_HALF_HANDICAP":       return handicapResult(label, htHome, htAway);
    case "SECOND_HALF_HANDICAP":      return handicapResult(label, shHome, shAway);
    case "CORNERS_TOTAL":             return corners ? totalsResult(label, corners.home + corners.away) : null;
    case "CORNERS_HANDICAP":          return corners ? handicapResult(label, corners.home, corners.away) : null;
    case "CARDS_TOTAL":               return cards ? totalsResult(label, cards.home + cards.away) : null;
    case "CARDS_HANDICAP":            return cards ? handicapResult(label, cards.home, cards.away) : null;
    default: return null;
  }
}

/**
 * Règle automatiquement les tickets physiques (TicketItem) dont la sélection
 * porte sur un marché que TheOddsAPI ne peut pas calculer depuis le score
 * final seul (mi-temps, corners, cartons) — voir STATS_MARKET_TYPES.
 *
 * Ne touche jamais aux paris en ligne (Bet/BetItem) : le règlement de ces
 * marchés y est déjà entièrement manuel (comme pour les marchés "simples"
 * via le score final — voir syncScoresAndSettle dans odds.service.ts, qui ne
 * règle lui non plus que les TicketItem), on garde la même convention ici.
 */
export async function syncApiFootballSettlement() {
  if (!API_FOOTBALL_KEY) return;
  fixturesByDateCache.clear();

  const events = await prisma.event.findMany({
    where: {
      status: "FINISHED",
      // Au-delà de quelques jours, les stats détaillées ne sont plus
      // consultables sur le forfait gratuit (fenêtre glissante observée) —
      // pas la peine de continuer à chercher.
      startTime: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      apiFootballAttempts: { lt: MAX_ATTEMPTS },
      markets: {
        some: {
          type: { in: STATS_MARKET_TYPES as unknown as string[] },
          odds: { some: { ticketItems: { some: { result: null } } } },
        },
      },
    },
    include: {
      markets: {
        where: { type: { in: STATS_MARKET_TYPES as unknown as string[] } },
        include: { odds: { include: { ticketItems: true } } },
      },
    },
    orderBy: { startTime: "desc" },
    take: MAX_EVENTS_PER_RUN,
  });

  let matchedCount = 0;
  let settledTicketsCount = 0;

  for (const event of events) {
    try {
      const fixture = await findFixture(event);
      await prisma.event.update({ where: { id: event.id }, data: { apiFootballAttempts: { increment: 1 } } });

      if (!fixture) {
        console.warn(`⚠️  API-Football — aucun match trouvé pour ${event.homeTeam} vs ${event.awayTeam} (${event.startTime.toISOString().slice(0, 10)})`);
        continue;
      }

      const htHome = fixture.score?.halftime?.home;
      const htAway = fixture.score?.halftime?.away;
      const ftHome = fixture.score?.fulltime?.home;
      const ftAway = fixture.score?.fulltime?.away;
      if (htHome == null || htAway == null || ftHome == null || ftAway == null) {
        console.warn(`⚠️  API-Football — score mi-temps indisponible pour ${event.homeTeam} vs ${event.awayTeam}`);
        continue;
      }

      const hasPending = (m: { type: string; odds: { ticketItems: { result: string | null }[] }[] }) =>
        m.odds.some((o) => o.ticketItems.some((ti) => ti.result === null));
      const needsCorners = event.markets.some((m) => (m.type === "CORNERS_TOTAL" || m.type === "CORNERS_HANDICAP") && hasPending(m));
      const needsCards   = event.markets.some((m) => (m.type === "CARDS_TOTAL"   || m.type === "CARDS_HANDICAP")   && hasPending(m));

      let corners: { home: number; away: number } | null = null;
      let cards:   { home: number; away: number } | null = null;
      if (needsCorners || needsCards) {
        await sleep(REQUEST_DELAY_MS);
        const stats = await apiFootballGet("/fixtures/statistics", { fixture: fixture.fixture.id });
        ({ corners, cards } = extractCornersCards(stats.response ?? [], event.homeTeam, event.awayTeam));
      }

      matchedCount++;
      const touchedTicketIds = new Set<string>();
      for (const market of event.markets) {
        for (const odd of market.odds) {
          const result = computeStatsItemResult(market.type, odd.label, htHome, htAway, ftHome, ftAway, corners, cards);
          if (!result) continue;
          for (const item of odd.ticketItems) {
            if (item.result !== null) continue;
            await prisma.ticketItem.update({ where: { id: item.id }, data: { result } });
            touchedTicketIds.add(item.ticketId);
          }
        }
      }

      for (const ticketId of touchedTicketIds) {
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { items: true } });
        if (ticket && ticket.status === "PENDING" && ticket.items.every((i) => i.result !== null)) {
          await settleTicket(ticketId);
          settledTicketsCount++;
        }
      }

      await sleep(REQUEST_DELAY_MS);
    } catch (err: any) {
      if (err instanceof Error && err.message === "API_FOOTBALL_QUOTA_EXHAUSTED") {
        console.warn("⚠️  API-Football — quota journalier atteint, arrêt du cycle en cours");
        break;
      }
      if (err.response?.status === 429) {
        console.warn("⚠️  API-Football — limite de débit atteinte, arrêt du cycle en cours");
        break;
      }
      console.warn(`⚠️  API-Football — échec pour ${event.homeTeam} vs ${event.awayTeam} : ${err.response?.status ?? "?"} ${JSON.stringify(err.response?.data ?? err.message)}`);
    }
  }

  if (matchedCount > 0 || settledTicketsCount > 0) {
    console.log(`📊 API-Football : ${matchedCount} match(s) rapprochés, ${settledTicketsCount} ticket(s) réglé(s) (mi-temps/corners/cartons)`);
  }
}
