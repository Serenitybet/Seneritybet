import axios from "axios";
import { prisma } from "../lib/prisma";
import { canMakeApiFootballRequest, recordApiFootballRequest } from "../lib/api-football.state";
import { settleTicket } from "./tpe.service";
import { STATS_MARKET_TYPES, computeStatsItemResult } from "../lib/stats-settlement";

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_DAILY_LIMIT = parseInt(process.env.API_FOOTBALL_DAILY_LIMIT ?? "100", 10);

// Valeurs relevées après passage au palier Pro (21/10/2026, 7 500 req/jour —
// contre 100 sur le forfait gratuit, qui limitait aussi le DÉBIT : un test
// manuel avait déclenché un 429 "Too Many Requests" après une dizaine
// d'appels rapprochés). Le délai entre appels est réduit mais pas supprimé
// par prudence (le palier Pro n'a pas de limite de débit documentée
// confirmée) ; le plafond d'évènements et de tentatives est relevé pour
// profiter du quota élargi sans attendre indéfiniment un match non couvert.
const MAX_EVENTS_PER_RUN = 40;
const REQUEST_DELAY_MS = 300;
const MAX_ATTEMPTS = 6;

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

type StatPair = { home: number; away: number } | null;

// Toutes ces stats viennent du MÊME appel /fixtures/statistics — déjà fait
// pour corners/cartons — donc tirs cadrés et fautes sont "gratuits" (aucun
// quota supplémentaire consommé) : il suffisait de lire d'autres champs de
// la réponse déjà récupérée.
function extractMatchStats(
  statsResponse: any[], homeTeam: string, awayTeam: string,
): { corners: StatPair; cards: StatPair; shots: StatPair; fouls: StatPair } {
  if (!statsResponse || statsResponse.length < 2) return { corners: null, cards: null, shots: null, fouls: null };

  const homeStats = statsResponse.find((t: any) => teamsMatch(t.team.name, homeTeam));
  const awayStats = statsResponse.find((t: any) => teamsMatch(t.team.name, awayTeam));
  if (!homeStats || !awayStats) return { corners: null, cards: null, shots: null, fouls: null };

  const statValue = (teamStats: any, type: string): number | null => {
    const s = teamStats.statistics?.find((s: any) => s.type?.toLowerCase() === type.toLowerCase());
    const v = s?.value;
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "") return parseInt(v, 10);
    return null;
  };

  let corners: StatPair = null;
  const hc = statValue(homeStats, "Corner Kicks");
  const ac = statValue(awayStats, "Corner Kicks");
  if (hc !== null && ac !== null) corners = { home: hc, away: ac };

  let cards: StatPair = null;
  const hy = statValue(homeStats, "Yellow Cards");
  const ay = statValue(awayStats, "Yellow Cards");
  if (hy !== null || ay !== null) {
    const hr = statValue(homeStats, "Red Cards") ?? 0;
    const ar = statValue(awayStats, "Red Cards") ?? 0;
    cards = { home: (hy ?? 0) + hr, away: (ay ?? 0) + ar };
  }

  let shots: StatPair = null;
  const hs = statValue(homeStats, "Shots on Goal");
  const as_ = statValue(awayStats, "Shots on Goal");
  if (hs !== null && as_ !== null) shots = { home: hs, away: as_ };

  let fouls: StatPair = null;
  const hf = statValue(homeStats, "Fouls");
  const af = statValue(awayStats, "Fouls");
  if (hf !== null && af !== null) fouls = { home: hf, away: af };

  return { corners, cards, shots, fouls };
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
      const needsShots   = event.markets.some((m) => m.type === "SHOTS_ON_TARGET_TOTAL" && hasPending(m));
      const needsFouls   = event.markets.some((m) => m.type === "FOULS_TOTAL"           && hasPending(m));

      let corners: { home: number; away: number } | null = null;
      let cards:   { home: number; away: number } | null = null;
      let shots:   { home: number; away: number } | null = null;
      let fouls:   { home: number; away: number } | null = null;
      if (needsCorners || needsCards || needsShots || needsFouls) {
        await sleep(REQUEST_DELAY_MS);
        const stats = await apiFootballGet("/fixtures/statistics", { fixture: fixture.fixture.id });
        ({ corners, cards, shots, fouls } = extractMatchStats(stats.response ?? [], event.homeTeam, event.awayTeam));
      }

      matchedCount++;
      const touchedTicketIds = new Set<string>();
      for (const market of event.markets) {
        for (const odd of market.odds) {
          const result = computeStatsItemResult(
            market.type, odd.label, event.homeTeam, event.awayTeam,
            htHome, htAway, ftHome, ftAway, corners, cards, shots, fouls,
          );
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
