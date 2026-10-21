import axios from "axios";
import { prisma } from "../lib/prisma";
import { updateCredits } from "../lib/credits.state";
import { settleTicket } from "./tpe.service";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY;

// Lignes de handicap "au quart" (ex: -0.25, +0.75) : le pari est en réalité
// scindé en deux moitiés de mise sur deux lignes voisines (-0.25 = moitié
// sur 0/remboursé-si-nul, moitié sur -0.5), ce que notre règlement
// automatique (WON/LOST/VOID binaire, voir computeItemResult) ne sait pas
// calculer correctement — il déclarerait à tort une victoire ou défaite
// complète. On exclut donc ces lignes à la source (handicap principal,
// alternatif, mi-temps, corners, cartons) ; seules les lignes entières ou
// à la demie (toujours correctement réglables) sont conservées.
function isQuarterLine(point: number): boolean {
  return Math.abs(Math.round(point * 4) % 2) === 1;
}

// ─── Ordre d'affichage canonique des issues ────────────────────────────────
//
// TheOddsAPI ne garantit pas l'ordre des "outcomes" dans sa réponse (varie
// selon le bookmaker retenu pour chaque match) — sans tri explicite, "1"
// pouvait apparaître avant ou après "2" selon le match, ce qui perturbe le
// repérage visuel des joueurs. Un seul ordre canonique par type de marché,
// appliqué ici (lecture) pour que web/coupon/pos l'affichent tous pareil
// sans dupliquer la logique côté client.
export const ODD_LABEL_ORDER: Record<string, string[]> = {
  MATCH_WINNER:              ["1", "X", "2"],
  FIRST_HALF_WINNER:         ["1", "X", "2"],
  SECOND_HALF_WINNER:        ["1", "X", "2"],
  DOUBLE_CHANCE:             ["1X", "12", "X2"],
  FIRST_HALF_DOUBLE_CHANCE:  ["1X", "12", "X2"],
  SECOND_HALF_DOUBLE_CHANCE: ["1X", "12", "X2"],
  BOTH_TEAMS_SCORE:          ["Oui", "Non"],
  DRAW_NO_BET:               ["1", "2"],
};

export function sortOddsByCanonicalOrder<T extends { label: string }>(marketType: string, odds: T[]): T[] {
  const order = ODD_LABEL_ORDER[marketType];
  if (!order) return odds;
  return [...odds].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

function sortEventMarketsOdds<T extends { markets: { type: string; odds: any[] }[] }>(event: T): T {
  return {
    ...event,
    markets: event.markets.map((m) => ({ ...m, odds: sortOddsByCanonicalOrder(m.type, m.odds) })),
  };
}

// Sports TheOddsAPI → slug interne + métadonnées
//
// Les 17 championnats ci-dessous sont ceux ciblés par Serenitybet (Tchad),
// confirmés disponibles via GET https://api.the-odds-api.com/v4/sports
// (vérifié le 19/10/2026). Deux championnats visés ne sont PAS couverts par
// TheOddsAPI et ne peuvent donc pas être synchronisés : République Tchèque
// et Égypte (aucune clé correspondante dans leur catalogue).
// Liste complète des clés TheOddsAPI récupérée le 21/10/2026 via
// GET /v4/sports?all=true (gratuit, hors quota) : ~164 compétitions tous
// sports confondus. Sélection volontairement ciblée ci-dessous plutôt
// qu'exhaustive — ajouter cricket/lacrosse/golf/rugby/handball n'aurait
// aucune pertinence pour notre marché (Tchad, culture foot) et gonflerait
// la consommation de crédits pour rien. Choix : championnats de foot à
// forte notoriété (dont La Liga et la CAN, absents jusqu'ici), quelques
// championnats "2e division" européens pour le volume, tennis élargi aux
// Grand Chelems + Masters 1000/WTA 1000, et WNBA/NCAAB en basket.
const SPORTS_CONFIG = [
  // ⚽ Football — championnats domestiques majeurs
  { key: "soccer_epl",                           slug: "football", name: "Premier League",       country: "England",      icon: "⚽", sortOrder: 1 }, // 1. Angleterre
  { key: "soccer_france_ligue_one",              slug: "football", name: "Ligue 1",              country: "France",       icon: "⚽", sortOrder: 1 }, // 2. France
  { key: "soccer_italy_serie_a",                 slug: "football", name: "Serie A",              country: "Italy",        icon: "⚽", sortOrder: 1 }, // 3. Italie
  { key: "soccer_germany_bundesliga",            slug: "football", name: "Bundesliga",           country: "Germany",      icon: "⚽", sortOrder: 1 }, // 4. Allemagne
  { key: "soccer_spain_la_liga",                 slug: "football", name: "La Liga",              country: "Spain",        icon: "⚽", sortOrder: 1 }, // Espagne — absent jusqu'ici malgré sa notoriété
  { key: "soccer_netherlands_eredivisie",        slug: "football", name: "Eredivisie",           country: "Netherlands",  icon: "⚽", sortOrder: 1 }, // 5. Pays-Bas
  { key: "soccer_spl",                           slug: "football", name: "Scottish Premiership",  country: "Scotland",     icon: "⚽", sortOrder: 1 }, // 6. Écosse
  { key: "soccer_norway_eliteserien",            slug: "football", name: "Eliteserien",          country: "Norway",       icon: "⚽", sortOrder: 1 }, // 7. Norvège
  { key: "soccer_saudi_arabia_pro_league",       slug: "football", name: "Saudi Pro League",     country: "Saudi Arabia", icon: "⚽", sortOrder: 1 }, // 9. Arabie Saoudite
  { key: "soccer_turkey_super_league",           slug: "football", name: "Süper Lig",            country: "Turkey",       icon: "⚽", sortOrder: 1 }, // 11. Turquie
  { key: "soccer_belgium_first_div",             slug: "football", name: "Jupiler Pro League",   country: "Belgium",      icon: "⚽", sortOrder: 1 }, // 12. Belgique
  { key: "soccer_switzerland_superleague",       slug: "football", name: "Super League",         country: "Switzerland",  icon: "⚽", sortOrder: 1 }, // 13. Suisse
  { key: "soccer_portugal_primeira_liga",        slug: "football", name: "Primeira Liga",        country: "Portugal",     icon: "⚽", sortOrder: 1 }, // 14. Portugal
  { key: "soccer_russia_premier_league",         slug: "football", name: "Premier Liga",         country: "Russia",       icon: "⚽", sortOrder: 1 }, // 15. Russie
  { key: "soccer_usa_mls",                       slug: "football", name: "MLS",                  country: "USA",          icon: "⚽", sortOrder: 1 },
  { key: "soccer_brazil_campeonato",             slug: "football", name: "Brasileirão Série A",  country: "Brazil",       icon: "⚽", sortOrder: 1 },
  { key: "soccer_argentina_primera_division",    slug: "football", name: "Primera División",     country: "Argentina",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_mexico_ligamx",                 slug: "football", name: "Liga MX",              country: "Mexico",       icon: "⚽", sortOrder: 1 },
  { key: "soccer_japan_j_league",                slug: "football", name: "J1 League",            country: "Japan",        icon: "⚽", sortOrder: 1 },
  { key: "soccer_korea_kleague1",                slug: "football", name: "K League 1",           country: "South Korea",  icon: "⚽", sortOrder: 1 },
  // ⚽ Football — championnats "2e division" européens (volume de matchs)
  { key: "soccer_efl_champ",                     slug: "football", name: "EFL Championship",     country: "England",      icon: "⚽", sortOrder: 1 },
  { key: "soccer_germany_bundesliga2",           slug: "football", name: "2. Bundesliga",        country: "Germany",      icon: "⚽", sortOrder: 1 },
  { key: "soccer_italy_serie_b",                 slug: "football", name: "Serie B",              country: "Italy",        icon: "⚽", sortOrder: 1 },
  { key: "soccer_france_ligue_two",              slug: "football", name: "Ligue 2",              country: "France",       icon: "⚽", sortOrder: 1 },
  { key: "soccer_spain_segunda_division",        slug: "football", name: "LaLiga 2",             country: "Spain",        icon: "⚽", sortOrder: 1 },
  // ⚽ Football — compétitions internationales/continentales
  { key: "soccer_uefa_champs_league",            slug: "football", name: "Champions League",     country: "Europe",       icon: "⚽", sortOrder: 1 }, // 17. Ligue des Champions
  { key: "soccer_uefa_europa_league",            slug: "football", name: "Europa League",        country: "Europe",       icon: "⚽", sortOrder: 1 }, // 18. Europa League
  { key: "soccer_uefa_europa_conference_league", slug: "football", name: "Conference League",    country: "Europe",       icon: "⚽", sortOrder: 1 }, // 19. Conference League
  { key: "soccer_fifa_world_cup",                slug: "football", name: "Coupe du Monde FIFA",  country: "World",        icon: "⚽", sortOrder: 1 },
  { key: "soccer_fifa_club_world_cup",           slug: "football", name: "Coupe du Monde des Clubs", country: "World",    icon: "⚽", sortOrder: 1 },
  { key: "soccer_uefa_european_championship",    slug: "football", name: "Euro (Championnat d'Europe)", country: "Europe", icon: "⚽", sortOrder: 1 },
  { key: "soccer_africa_cup_of_nations",         slug: "football", name: "CAN (Coupe d'Afrique des Nations)", country: "Africa", icon: "⚽", sortOrder: 1 },
  { key: "soccer_conmebol_copa_america",         slug: "football", name: "Copa América",         country: "South America", icon: "⚽", sortOrder: 1 },
  { key: "soccer_conmebol_copa_libertadores",    slug: "football", name: "Copa Libertadores",    country: "South America", icon: "⚽", sortOrder: 1 },
  { key: "soccer_conmebol_copa_sudamericana",    slug: "football", name: "Copa Sudamericana",    country: "South America", icon: "⚽", sortOrder: 1 },
  { key: "soccer_concacaf_gold_cup",             slug: "football", name: "Gold Cup CONCACAF",    country: "North America", icon: "⚽", sortOrder: 1 },
  // 🏀 Basketball
  { key: "basketball_nba",               slug: "basketball", name: "NBA",                   country: "USA",      icon: "🏀", sortOrder: 2 },
  { key: "basketball_euroleague",        slug: "basketball", name: "Euroleague",             country: "Europe",   icon: "🏀", sortOrder: 2 },
  { key: "basketball_wnba",              slug: "basketball", name: "WNBA",                   country: "USA",      icon: "🏀", sortOrder: 2 },
  { key: "basketball_ncaab",             slug: "basketball", name: "NCAA Basketball",         country: "USA",      icon: "🏀", sortOrder: 2 },
  // 🎾 Tennis — Grand Chelems (ATP + WTA) et Masters 1000 / WTA 1000
  { key: "tennis_atp_aus_open_singles",  slug: "tennis",     name: "Open d'Australie (ATP)", country: "Australia", icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_aus_open_singles",  slug: "tennis",     name: "Open d'Australie (WTA)", country: "Australia", icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_french_open",       slug: "tennis",     name: "Roland Garros (ATP)",   country: "France",   icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_french_open",       slug: "tennis",     name: "Roland Garros (WTA)",   country: "France",   icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_wimbledon",         slug: "tennis",     name: "Wimbledon (ATP)",       country: "England",  icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_wimbledon",         slug: "tennis",     name: "Wimbledon (WTA)",       country: "England",  icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_us_open",           slug: "tennis",     name: "US Open (ATP)",         country: "USA",      icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_us_open",           slug: "tennis",     name: "US Open (WTA)",         country: "USA",      icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_indian_wells",      slug: "tennis",     name: "Indian Wells (ATP)",    country: "USA",      icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_indian_wells",      slug: "tennis",     name: "Indian Wells (WTA)",    country: "USA",      icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_miami_open",        slug: "tennis",     name: "Miami Open (ATP)",      country: "USA",      icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_miami_open",        slug: "tennis",     name: "Miami Open (WTA)",      country: "USA",      icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_madrid_open",       slug: "tennis",     name: "Madrid Open (ATP)",     country: "Spain",    icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_madrid_open",       slug: "tennis",     name: "Madrid Open (WTA)",     country: "Spain",    icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_italian_open",      slug: "tennis",     name: "Rome / Italian Open (ATP)", country: "Italy", icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_italian_open",      slug: "tennis",     name: "Rome / Italian Open (WTA)", country: "Italy", icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_canadian_open",     slug: "tennis",     name: "Canada Masters (ATP)",  country: "Canada",   icon: "🎾", sortOrder: 3 },
  { key: "tennis_wta_canadian_open",     slug: "tennis",     name: "Canada Open (WTA)",     country: "Canada",   icon: "🎾", sortOrder: 3 },
  { key: "tennis_atp_cincinnati_open",   slug: "tennis",     name: "Cincinnati Masters (ATP)", country: "USA",   icon: "🎾", sortOrder: 3 },
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

      // Upsert compétition — le slug est calculé une seule fois pour que la
      // recherche (where) et la création (create) utilisent toujours la même
      // valeur, même pour les noms avec caractères spéciaux (ex. "Süper Lig").
      const competitionSlug = config.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const competition = await prisma.competition.upsert({
        where:  { slug: competitionSlug },
        update: { name: config.name },
        create: {
          name:    config.name,
          slug:    competitionSlug,
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
      // Format aligné sur celui des marchés alternatifs (handicap/plus-moins)
      // pour permettre la fusion à l'affichage (même ligne = même libellé).
      let label: string;
      if (apiMarket.key === "spreads") {
        const point = Number(outcome.point);
        if (isQuarterLine(point)) continue; // non réglable automatiquement — voir isQuarterLine
        const side = outcome.name === game.home_team ? "1" : outcome.name === game.away_team ? "2" : outcome.name;
        label = `${side} (${point >= 0 ? "+" : ""}${point})`;
      } else if (apiMarket.key === "totals") {
        label = `${outcome.name === "Over" ? "Plus" : "Moins"} ${outcome.point}`;
      } else {
        label = outcome.name === game.home_team ? "1"
          : outcome.name === game.away_team ? "2"
          : outcome.name === "Draw" ? "X"
          : outcome.name;
      }

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
// Fenêtre alignée sur le sync principal (J0 à J+7) : les parieurs doivent
// pouvoir composer des combinés sur toute la semaine avec les mêmes options,
// pas seulement sur les matchs des 48h à venir. Le coût réel (quelques
// milliers de crédits pour couvrir tout le calendrier de la semaine, sur
// 100 000/mois) ne justifie pas d'étaler la couverture sur plusieurs heures :
// plafond large pour que tout le calendrier passe en un seul cycle (toutes
// les 30 min), récupéré une seule fois par match (pas de rafraîchissement
// répété comme pour les marchés principaux). Les crédits utilisés/restants
// sont loggés à chaque sync (voir lib/credits.state) — à surveiller : si le
// budget mensuel approche sa limite, réduire EXTRA_MARKETS_LIMIT ou passer
// sur un palier TheOddsAPI supérieur.
const SPORT_KEY_BY_COMPETITION_NAME: Record<string, string> = Object.fromEntries(
  SPORTS_CONFIG.map((c) => [c.name, c.key]),
);
const EXTRA_MARKETS_LIMIT = 600;

// À incrémenter à chaque fois que le jeu de marchés additionnels change
// (ajout/retrait d'une clé dans l'appel ci-dessous), pour que les matchs
// déjà traités sous une version antérieure soient retraités une fois.
const EXTRA_MARKETS_VERSION = 7; // v1: btts+double_chance ; v2: + correct_score, draw_no_bet, alternate_totals ; v3: fix libellé double chance + plus/moins à 6 lignes ; v4: plus/moins alternatif limité aux lignes X.5 ; v5: + handicap alternatif ; v6: + totaux par équipe ; v7: fix plus/moins alternatif laissait passer les lignes au quart (3.75, 4.25)

export async function syncExtraMarkets() {
  if (!API_KEY) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);

  const events = await prisma.event.findMany({
    where: {
      status: { in: ["UPCOMING", "LIVE"] },
      startTime: { gte: new Date(), lte: cutoff },
      competition: { name: { in: Object.keys(SPORT_KEY_BY_COMPETITION_NAME) } },
      extraMarketsVersion: { lt: EXTRA_MARKETS_VERSION },
    },
    include: { competition: true },
    // Matchs les plus proches en premier — sans ça, un match capital du
    // jour peut rester coincé derrière des centaines d'autres plus
    // lointains dans une file sans ordre défini (comportement Prisma/
    // Postgres par défaut).
    orderBy: { startTime: "asc" },
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
            markets:    "btts,double_chance,correct_score,draw_no_bet,alternate_totals,alternate_spreads,team_totals",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertExtraMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? []);
      await prisma.event.update({ where: { id: event.id }, data: { extraMarketsVersion: EXTRA_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422 (pas de données additionnelles pour ce match) ou autre erreur : on ignore et on continue
    }
  }

  if (synced > 0) console.log(`🎯 Marchés additionnels (BTTS, double chance, score exact, remboursé si nul, plus/moins alternatif, handicap alternatif, totaux par équipe) : ${synced} match(s) synchronisés`);
}

// Pas un seul bookmaker n'offre systématiquement les 4 marchés (vérifié
// empiriquement) : on fusionne plusieurs bookmakers, le premier qui propose
// chaque marché étant retenu pour ce marché, en suivant l'ordre de priorité.
const EXTRA_MARKET_TYPE_BY_KEY: Record<string, string> = {
  btts:               "BOTH_TEAMS_SCORE",
  double_chance:      "DOUBLE_CHANCE",
  correct_score:      "CORRECT_SCORE",
  draw_no_bet:        "DRAW_NO_BET",
  alternate_totals:   "ALTERNATE_TOTALS",
  alternate_spreads:  "ALTERNATE_SPREADS",
  team_totals:        "TEAM_TOTALS",
};

// Plus/moins alternatif : l'API renvoie souvent 8-10 lignes (0.5 à 5.5+
// buts) — on se limite aux 6 lignes les plus basses (0.5 à 5.5, la plage
// standard chez la plupart des bookmakers) pour garder l'écran de caisse
// lisible tout en couvrant tous les scores réalistes d'un match de foot.
const ALTERNATE_TOTALS_MAX_LINES = 6;

// Handicap alternatif : on garde les lignes les plus proches de zéro (les
// plus pertinentes — un handicap de ±5 buts est rarement joué).
const ALTERNATE_SPREADS_MAX_LINES = 6;

// Totaux par équipe : plafond de lignes par équipe (observé en pratique :
// souvent une seule ligne par équipe chez la plupart des bookmakers).
const TEAM_TOTALS_MAX_LINES_PER_TEAM = 3;

async function upsertExtraMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[]) {
  const priorityKeys = ["bet365", "unibet", "betway", "onexbet", "pinnacle"];
  const orderedBookmakers = [
    ...priorityKeys.map((k) => bookmakers.find((b: any) => b.key === k)).filter(Boolean),
    ...bookmakers,
  ];

  const seenTypes = new Set<string>();

  for (const bookmaker of orderedBookmakers) {
    for (const apiMarket of bookmaker.markets ?? []) {
      const marketType = EXTRA_MARKET_TYPE_BY_KEY[apiMarket.key];
      if (!marketType || seenTypes.has(marketType)) continue;
      seenTypes.add(marketType);

      const marketName =
        apiMarket.key === "btts"               ? "Les deux équipes marquent" :
        apiMarket.key === "double_chance"      ? `Double chance : ${homeTeam} vs ${awayTeam}` :
        apiMarket.key === "correct_score"      ? "Score exact" :
        apiMarket.key === "alternate_totals"   ? "Plus/Moins (autres lignes)" :
        apiMarket.key === "alternate_spreads"  ? "Handicap (autres lignes)" :
        apiMarket.key === "team_totals"        ? "Totaux par équipe" :
        "Remboursé si match nul";

      let market = await prisma.market.findFirst({ where: { eventId, type: marketType as any } });
      if (!market) {
        market = await prisma.market.create({ data: { eventId, name: marketName, type: marketType as any } });
      }

      // Plus/moins alternatif : certains bookmakers mélangent des lignes
      // entières (1, 2, 3 — avec possibilité de remboursé) et des lignes à
      // virgule (0.5, 1.5, 2.5 — sans remboursé possible). On ne garde que
      // les lignes à virgule, seules utilisées par les books grand public
      // (cohérent avec le marché "Plus/Moins" principal qui est toujours en
      // X.5), plafonnées aux plus basses (les plus pertinentes en foot).
      let outcomes = apiMarket.outcomes;
      if (apiMarket.key === "alternate_totals") {
        const points = [...new Set(outcomes.map((o: any) => o.point))]
          .filter((p): p is number => typeof p === "number" && p % 1 === 0.5)
          .sort((a, b) => a - b)
          .slice(0, ALTERNATE_TOTALS_MAX_LINES);
        outcomes = outcomes.filter((o: any) => points.includes(o.point));
      } else if (apiMarket.key === "alternate_spreads") {
        // Les lignes sont symétriques (home -1.5 / away +1.5 = même ligne) —
        // on regroupe par valeur absolue et on garde les plus proches de 0.
        // Lignes au quart (0.25, 0.75...) exclues — voir isQuarterLine.
        const absPoints = [...new Set(outcomes.map((o: any) => Math.abs(o.point)))]
          .filter((p): p is number => typeof p === "number" && p > 0 && !isQuarterLine(p))
          .sort((a, b) => a - b)
          .slice(0, ALTERNATE_SPREADS_MAX_LINES);
        outcomes = outcomes.filter((o: any) => absPoints.includes(Math.abs(o.point)));
      } else if (apiMarket.key === "team_totals") {
        // Une ligne par équipe (identifiée par outcome.description), plafonnée
        // aux plus basses par équipe.
        const pointsByTeam = new Map<string, number[]>();
        for (const o of outcomes) {
          if (typeof o.point !== "number") continue;
          const list = pointsByTeam.get(o.description) ?? [];
          if (!list.includes(o.point)) list.push(o.point);
          pointsByTeam.set(o.description, list);
        }
        const keptByTeam = new Map(
          [...pointsByTeam.entries()].map(([team, points]) => [
            team,
            points.sort((a, b) => a - b).slice(0, TEAM_TOTALS_MAX_LINES_PER_TEAM),
          ]),
        );
        outcomes = outcomes.filter((o: any) => keptByTeam.get(o.description)?.includes(o.point));
      }

      for (const outcome of outcomes) {
        let label: string;
        if (apiMarket.key === "btts") {
          label = outcome.name === "Yes" ? "Oui" : "Non";
        } else if (apiMarket.key === "double_chance") {
          // TheOddsAPI n'ordonne pas toujours "home or away" dans le même
          // sens ("Al-Ahli or Al-Fayha" au lieu de "Al-Fayha or Al-Ahli") —
          // on détecte par présence de "Draw" plutôt que par égalité stricte.
          const name = String(outcome.name);
          label = name.includes("Draw")
            ? (name.startsWith(homeTeam) ? "1X" : "X2")
            : "12";
        } else if (apiMarket.key === "correct_score") {
          // Format TheOddsAPI : "Équipe1:0|Équipe2:0" → "0-0"
          const [homePart, awayPart] = String(outcome.name).split("|");
          const homeGoals = homePart?.split(":").pop()?.trim();
          const awayGoals = awayPart?.split(":").pop()?.trim();
          label = homeGoals !== undefined && awayGoals !== undefined ? `${homeGoals}-${awayGoals}` : outcome.name;
        } else if (apiMarket.key === "alternate_totals") {
          label = `${outcome.name === "Over" ? "Plus" : "Moins"} ${outcome.point}`;
        } else if (apiMarket.key === "alternate_spreads") {
          const side = outcome.name === homeTeam ? "1" : outcome.name === awayTeam ? "2" : outcome.name;
          const point = Number(outcome.point);
          label = `${side} (${point >= 0 ? "+" : ""}${point})`;
        } else if (apiMarket.key === "team_totals") {
          label = `${outcome.description} ${outcome.name === "Over" ? "Plus" : "Moins"} ${outcome.point}`;
        } else {
          // draw_no_bet : une issue par équipe, pas de match nul
          label =
            outcome.name === homeTeam ? "1" :
            outcome.name === awayTeam ? "2" :
            outcome.name;
        }

        const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
        if (existing) {
          await prisma.odd.update({ where: { id: existing.id }, data: { value: outcome.price } });
        } else {
          await prisma.odd.create({ data: { marketId: market.id, label, value: outcome.price } });
        }
      }
    }
  }
}

// ─── Marchés "statistiques" (mi-temps, corners, cartons) — football uniquement ─
//
// Clés du catalogue officiel TheOddsAPI (recherche menée le 19/10/2026,
// https://the-odds-api.com/sports-odds-data/betting-markets.html) : h2h_h1 /
// h2h_h2 (vainqueur d'une seule mi-temps), alternate_totals_corners /
// alternate_spreads_corners (total/handicap corners), alternate_totals_cards
// / alternate_spreads_cards (total/handicap cartons). Comme pour
// syncExtraMarkets, uniquement disponibles via l'endpoint par match.
//
// Lot (et version) volontairement séparés de syncExtraMarkets : si une de
// ces clés s'avère en réalité invalide ou mal couverte chez les bookmakers
// EU suivis, seul CE lot échoue (422 → ignoré, retenté au cycle suivant)
// sans jamais faire régresser la synchronisation des marchés additionnels
// déjà éprouvés (BTTS, double chance, score exact...). À surveiller les
// premiers jours : si les logs ne montrent jamais "marchés stats
// synchronisés", revérifier ces clés avant d'investiguer plus loin.
//
// Non calculables automatiquement au résultat final : TheOddsAPI ne fournit
// ni le score à la mi-temps ni le nombre de corners/cartons via /scores.
// Ces sélections restent PENDING jusqu'à saisie manuelle d'un trader
// (PATCH /api/admin/tickets/:id/result — déjà en place côté backoffice).
const FOOTBALL_SPORT_KEY_BY_COMPETITION_NAME: Record<string, string> = Object.fromEntries(
  SPORTS_CONFIG.filter((c) => c.slug === "football").map((c) => [c.name, c.key]),
);
const PROP_MARKETS_LIMIT = 600;
const PROP_MARKETS_VERSION = 1;

export async function syncPropMarkets() {
  if (!API_KEY) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);

  const events = await prisma.event.findMany({
    where: {
      status: { in: ["UPCOMING", "LIVE"] },
      startTime: { gte: new Date(), lte: cutoff },
      competition: { name: { in: Object.keys(FOOTBALL_SPORT_KEY_BY_COMPETITION_NAME) } },
      propMarketsVersion: { lt: PROP_MARKETS_VERSION },
    },
    include: { competition: true },
    orderBy: { startTime: "asc" }, // matchs les plus proches en premier — voir syncExtraMarkets
    take: PROP_MARKETS_LIMIT,
  });

  let synced = 0;
  for (const event of events) {
    const sportKey = FOOTBALL_SPORT_KEY_BY_COMPETITION_NAME[event.competition.name];
    if (!sportKey || !event.externalId) continue;

    try {
      const res = await axios.get(
        `${ODDS_API_BASE}/sports/${sportKey}/events/${event.externalId}/odds`,
        {
          params: {
            apiKey:     API_KEY,
            regions:    "eu",
            markets:    "h2h_h1,h2h_h2,alternate_totals_corners,alternate_spreads_corners,alternate_totals_cards,alternate_spreads_cards",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertPropMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? []);
      await prisma.event.update({ where: { id: event.id }, data: { propMarketsVersion: PROP_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422 (marché non proposé pour ce match, ou clé invalide) ou autre erreur : on ignore et on continue
    }
  }

  if (synced > 0) console.log(`🥅 Marchés stats (1ère/2nde mi-temps, corners, cartons) : ${synced} match(s) synchronisés`);
}

const PROP_MARKET_TYPE_BY_KEY: Record<string, string> = {
  h2h_h1:                     "FIRST_HALF_WINNER",
  h2h_h2:                     "SECOND_HALF_WINNER",
  alternate_totals_corners:   "CORNERS_TOTAL",
  alternate_spreads_corners:  "CORNERS_HANDICAP",
  alternate_totals_cards:     "CARDS_TOTAL",
  alternate_spreads_cards:    "CARDS_HANDICAP",
};

const PROP_TOTALS_MAX_LINES  = 6;
const PROP_SPREADS_MAX_LINES = 6;

async function upsertPropMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[]) {
  const priorityKeys = ["bet365", "unibet", "betway", "onexbet", "pinnacle"];
  const orderedBookmakers = [
    ...priorityKeys.map((k) => bookmakers.find((b: any) => b.key === k)).filter(Boolean),
    ...bookmakers,
  ];

  const seenTypes = new Set<string>();

  for (const bookmaker of orderedBookmakers) {
    for (const apiMarket of bookmaker.markets ?? []) {
      const marketType = PROP_MARKET_TYPE_BY_KEY[apiMarket.key];
      if (!marketType || seenTypes.has(marketType)) continue;
      seenTypes.add(marketType);

      const marketName =
        apiMarket.key === "h2h_h1"                    ? "Résultat 1ère mi-temps" :
        apiMarket.key === "h2h_h2"                    ? "Résultat 2nde mi-temps" :
        apiMarket.key === "alternate_totals_corners"  ? "Total corners" :
        apiMarket.key === "alternate_spreads_corners" ? "Handicap corners" :
        apiMarket.key === "alternate_totals_cards"    ? "Total cartons" :
        "Handicap cartons";

      let market = await prisma.market.findFirst({ where: { eventId, type: marketType as any } });
      if (!market) {
        market = await prisma.market.create({ data: { eventId, name: marketName, type: marketType as any } });
      }

      // Lignes totaux (corners/cartons) : on privilégie les lignes à virgule
      // (X.5, sans push possible), comme pour le plus/moins de buts — mais à
      // défaut (si un bookmaker ne propose que des lignes entières pour ces
      // marchés, moins standard qu'au foot sur les buts), on retombe sur
      // toutes les lignes disponibles plutôt que de perdre le marché entier.
      let outcomes = apiMarket.outcomes;
      if (apiMarket.key === "alternate_totals_corners" || apiMarket.key === "alternate_totals_cards") {
        const allPoints = [...new Set(outcomes.map((o: any) => o.point))].filter((p): p is number => typeof p === "number");
        const halfPoints = allPoints.filter((p) => p % 1 === 0.5).sort((a, b) => a - b);
        const points = (halfPoints.length > 0 ? halfPoints : allPoints.sort((a, b) => a - b)).slice(0, PROP_TOTALS_MAX_LINES);
        outcomes = outcomes.filter((o: any) => points.includes(o.point));
      } else if (apiMarket.key === "alternate_spreads_corners" || apiMarket.key === "alternate_spreads_cards") {
        // Lignes au quart exclues — voir isQuarterLine.
        const absPoints = [...new Set(outcomes.map((o: any) => Math.abs(o.point)))]
          .filter((p): p is number => typeof p === "number" && p > 0 && !isQuarterLine(p))
          .sort((a, b) => a - b)
          .slice(0, PROP_SPREADS_MAX_LINES);
        outcomes = outcomes.filter((o: any) => absPoints.includes(Math.abs(o.point)));
      }

      for (const outcome of outcomes) {
        let label: string;
        if (apiMarket.key === "h2h_h1" || apiMarket.key === "h2h_h2") {
          label = outcome.name === homeTeam ? "1"
            : outcome.name === awayTeam ? "2"
            : outcome.name === "Draw" ? "X"
            : outcome.name;
        } else if (apiMarket.key === "alternate_totals_corners") {
          label = `${outcome.name === "Over" ? "Plus" : "Moins"} ${outcome.point} corners`;
        } else if (apiMarket.key === "alternate_totals_cards") {
          label = `${outcome.name === "Over" ? "Plus" : "Moins"} ${outcome.point} cartons`;
        } else {
          // alternate_spreads_corners / alternate_spreads_cards
          const side = outcome.name === homeTeam ? "1" : outcome.name === awayTeam ? "2" : outcome.name;
          const point = Number(outcome.point);
          label = `${side} (${point >= 0 ? "+" : ""}${point})`;
        }

        const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
        if (existing) {
          await prisma.odd.update({ where: { id: existing.id }, data: { value: outcome.price } });
        } else {
          await prisma.odd.create({ data: { marketId: market.id, label, value: outcome.price } });
        }
      }
    }
  }
}

// ─── Marchés "mi-temps" (plus/moins, handicap, double chance) — football ──────
//
// Objectif : offrir sur chaque mi-temps les mêmes familles de marchés que
// sur le match complet (plus/moins, handicap, double chance). TheOddsAPI
// documente les clés totals_h1/h2 et double_chance_h1/h2 ; spreads_h1/h2
// suit la même convention (confirmée par h2h_h1/h2h_h2, déjà utilisées dans
// syncPropMarkets) mais sans documentation officielle trouvée — à surveiller
// dans les logs. Couverture bookmakers probablement plus faible qu'en match
// complet (marché plus confidentiel) : lot séparé de syncPropMarkets, comme
// celui-ci l'est de syncExtraMarkets, pour qu'une clé invalide ou mal
// couverte ne fasse régresser aucun des deux lots déjà éprouvés.
const HALF_MARKETS_LIMIT = 600;
const HALF_MARKETS_VERSION = 1;

export async function syncHalfMarkets() {
  if (!API_KEY) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);

  const events = await prisma.event.findMany({
    where: {
      status: { in: ["UPCOMING", "LIVE"] },
      startTime: { gte: new Date(), lte: cutoff },
      competition: { name: { in: Object.keys(FOOTBALL_SPORT_KEY_BY_COMPETITION_NAME) } },
      halfMarketsVersion: { lt: HALF_MARKETS_VERSION },
    },
    include: { competition: true },
    orderBy: { startTime: "asc" }, // matchs les plus proches en premier — voir syncExtraMarkets
    take: HALF_MARKETS_LIMIT,
  });

  let synced = 0;
  for (const event of events) {
    const sportKey = FOOTBALL_SPORT_KEY_BY_COMPETITION_NAME[event.competition.name];
    if (!sportKey || !event.externalId) continue;

    try {
      const res = await axios.get(
        `${ODDS_API_BASE}/sports/${sportKey}/events/${event.externalId}/odds`,
        {
          params: {
            apiKey:     API_KEY,
            regions:    "eu",
            markets:    "totals_h1,totals_h2,spreads_h1,spreads_h2,double_chance_h1,double_chance_h2",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertHalfMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? []);
      await prisma.event.update({ where: { id: event.id }, data: { halfMarketsVersion: HALF_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422 (marché non proposé pour ce match, ou clé invalide) ou autre erreur : on ignore et on continue
    }
  }

  if (synced > 0) console.log(`⏱  Marchés mi-temps (plus/moins, handicap, double chance) : ${synced} match(s) synchronisés`);
}

const HALF_MARKET_TYPE_BY_KEY: Record<string, string> = {
  totals_h1:        "FIRST_HALF_TOTALS",
  spreads_h1:       "FIRST_HALF_HANDICAP",
  double_chance_h1: "FIRST_HALF_DOUBLE_CHANCE",
  totals_h2:        "SECOND_HALF_TOTALS",
  spreads_h2:       "SECOND_HALF_HANDICAP",
  double_chance_h2: "SECOND_HALF_DOUBLE_CHANCE",
};

const HALF_TOTALS_MAX_LINES  = 4;
const HALF_SPREADS_MAX_LINES = 4;

async function upsertHalfMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[]) {
  const priorityKeys = ["bet365", "unibet", "betway", "onexbet", "pinnacle"];
  const orderedBookmakers = [
    ...priorityKeys.map((k) => bookmakers.find((b: any) => b.key === k)).filter(Boolean),
    ...bookmakers,
  ];

  const seenTypes = new Set<string>();

  for (const bookmaker of orderedBookmakers) {
    for (const apiMarket of bookmaker.markets ?? []) {
      const marketType = HALF_MARKET_TYPE_BY_KEY[apiMarket.key];
      if (!marketType || seenTypes.has(marketType)) continue;
      seenTypes.add(marketType);

      const marketName =
        apiMarket.key === "totals_h1"        ? "Plus/Moins 1ère mi-temps" :
        apiMarket.key === "totals_h2"        ? "Plus/Moins 2nde mi-temps" :
        apiMarket.key === "spreads_h1"       ? "Handicap 1ère mi-temps" :
        apiMarket.key === "spreads_h2"       ? "Handicap 2nde mi-temps" :
        apiMarket.key === "double_chance_h1" ? "Double chance 1ère mi-temps" :
        "Double chance 2nde mi-temps";

      let market = await prisma.market.findFirst({ where: { eventId, type: marketType as any } });
      if (!market) {
        market = await prisma.market.create({ data: { eventId, name: marketName, type: marketType as any } });
      }

      let outcomes = apiMarket.outcomes;
      if (apiMarket.key === "totals_h1" || apiMarket.key === "totals_h2") {
        const points = [...new Set(outcomes.map((o: any) => o.point))]
          .filter((p): p is number => typeof p === "number" && p % 1 === 0.5)
          .sort((a, b) => a - b)
          .slice(0, HALF_TOTALS_MAX_LINES);
        outcomes = outcomes.filter((o: any) => points.includes(o.point));
      } else if (apiMarket.key === "spreads_h1" || apiMarket.key === "spreads_h2") {
        // Lignes au quart exclues — voir isQuarterLine.
        const absPoints = [...new Set(outcomes.map((o: any) => Math.abs(o.point)))]
          .filter((p): p is number => typeof p === "number" && p > 0 && !isQuarterLine(p))
          .sort((a, b) => a - b)
          .slice(0, HALF_SPREADS_MAX_LINES);
        outcomes = outcomes.filter((o: any) => absPoints.includes(Math.abs(o.point)));
      }

      for (const outcome of outcomes) {
        let label: string;
        if (apiMarket.key === "totals_h1" || apiMarket.key === "totals_h2") {
          label = `${outcome.name === "Over" ? "Plus" : "Moins"} ${outcome.point}`;
        } else if (apiMarket.key === "spreads_h1" || apiMarket.key === "spreads_h2") {
          const side = outcome.name === homeTeam ? "1" : outcome.name === awayTeam ? "2" : outcome.name;
          const point = Number(outcome.point);
          label = `${side} (${point >= 0 ? "+" : ""}${point})`;
        } else {
          // double_chance_h1 / double_chance_h2 — même convention que double_chance (match complet)
          const name = String(outcome.name);
          label = name.includes("Draw")
            ? (name.startsWith(homeTeam) ? "1X" : "X2")
            : "12";
        }

        const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
        if (existing) {
          await prisma.odd.update({ where: { id: existing.id }, data: { value: outcome.price } });
        } else {
          await prisma.odd.create({ data: { marketId: market.id, label, value: outcome.price } });
        }
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

  return { events: events.map(sortEventMarketsOdds), total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Résultats finaux & règlement automatique des tickets ─────────────────
//
// TheOddsAPI expose un endpoint /scores par championnat qui renvoie, pour
// les matchs terminés des `daysFrom` derniers jours, le score final. On
// l'interroge pour chaque championnat suivi, on marque l'événement comme
// FINISHED avec son score, puis on en déduit le résultat (gagné/perdu/
// remboursé) de chaque sélection de ticket liée à ce match — le ticket se
// règle alors automatiquement dès que toutes ses sélections ont un résultat
// (voir settleTicket dans tpe.service.ts).
const DAYS_FROM_SCORES = 3;

export async function syncScoresAndSettle() {
  if (!API_KEY) return;

  let settledCount = 0;

  for (const config of SPORTS_CONFIG) {
    try {
      const res = await axios.get(`${ODDS_API_BASE}/sports/${config.key}/scores`, {
        params: { apiKey: API_KEY, daysFrom: DAYS_FROM_SCORES, dateFormat: "iso" },
        timeout: 10000,
      });

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      for (const game of res.data ?? []) {
        if (!game.completed || !Array.isArray(game.scores)) continue;

        const homeRaw = game.scores.find((s: any) => s.name === game.home_team)?.score;
        const awayRaw = game.scores.find((s: any) => s.name === game.away_team)?.score;
        if (homeRaw == null || awayRaw == null) continue;
        const homeScore = parseInt(homeRaw, 10);
        const awayScore = parseInt(awayRaw, 10);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) continue;

        const event = await prisma.event.findUnique({ where: { externalId: game.id } });
        if (!event) continue;
        // Déjà traité avec le même score lors d'un cycle précédent.
        if (event.status === "FINISHED" && event.homeScore === homeScore && event.awayScore === awayScore) continue;

        await prisma.event.update({
          where: { id: event.id },
          data: { status: "FINISHED", homeScore, awayScore, result: `${homeScore}-${awayScore}` },
        });

        settledCount += await settleEventTickets(event.id, event.homeTeam, event.awayTeam, homeScore, awayScore);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422/404 (pas de scores pour ce championnat) ou autre erreur : on ignore et on continue
    }
  }

  if (settledCount > 0) console.log(`🏁 Résultats automatiques : ${settledCount} ticket(s) réglé(s)`);
}

/** Déduit et enregistre le résultat de chaque sélection de ticket encore en attente liée à ce match, puis règle les tickets devenus complets. */
async function settleEventTickets(
  eventId: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number,
): Promise<number> {
  const items = await prisma.ticketItem.findMany({
    where: { result: null, market: { eventId } },
    include: { odd: true, market: true, ticket: true },
  });

  const touchedTicketIds = new Set<string>();
  for (const item of items) {
    if (item.ticket.status !== "PENDING") continue;
    const result = computeItemResult(item.market.type, item.odd.label, homeTeam, awayTeam, homeScore, awayScore);
    if (!result) continue; // type de marché ou libellé non calculable automatiquement — laissé pour saisie manuelle
    await prisma.ticketItem.update({ where: { id: item.id }, data: { result } });
    touchedTicketIds.add(item.ticketId);
  }

  let settledCount = 0;
  for (const ticketId of touchedTicketIds) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { items: true } });
    if (ticket && ticket.status === "PENDING" && ticket.items.every((i) => i.result !== null)) {
      await settleTicket(ticketId);
      settledCount++;
    }
  }
  return settledCount;
}

/** Calcule le résultat d'une sélection à partir du score final — null si le marché/libellé n'est pas reconnu (saisie manuelle requise). */
function computeItemResult(
  marketType: string, label: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number,
): "WON" | "LOST" | "VOID" | null {
  switch (marketType) {
    case "MATCH_WINNER": {
      const winner = homeScore > awayScore ? "1" : awayScore > homeScore ? "2" : "X";
      return label === winner ? "WON" : "LOST";
    }
    case "DRAW_NO_BET": {
      if (homeScore === awayScore) return "VOID"; // remboursé en cas de match nul
      const winner = homeScore > awayScore ? "1" : "2";
      return label === winner ? "WON" : "LOST";
    }
    case "DOUBLE_CHANCE": {
      const homeOrDraw = homeScore >= awayScore;
      const awayOrDraw = awayScore >= homeScore;
      const notDraw    = homeScore !== awayScore;
      const won = label === "1X" ? homeOrDraw : label === "X2" ? awayOrDraw : label === "12" ? notDraw : null;
      return won === null ? null : won ? "WON" : "LOST";
    }
    case "BOTH_TEAMS_SCORE": {
      if (label !== "Oui" && label !== "Non") return null;
      const bothScored = homeScore > 0 && awayScore > 0;
      return (label === "Oui") === bothScored ? "WON" : "LOST";
    }
    case "CORRECT_SCORE": {
      return label === `${homeScore}-${awayScore}` ? "WON" : "LOST";
    }
    case "OVER_UNDER":
    case "ALTERNATE_TOTALS": {
      const m = label.match(/^(Plus|Moins)\s+([\d.]+)$/);
      if (!m) return null;
      const line = parseFloat(m[2]);
      const total = homeScore + awayScore;
      if (total === line) return "VOID"; // ligne entière atteinte pile — remboursé
      return (m[1] === "Plus") === (total > line) ? "WON" : "LOST";
    }
    case "HANDICAP":
    case "ALTERNATE_SPREADS": {
      const m = label.match(/^([12])\s*\(([+-]?[\d.]+)\)$/);
      if (!m) return null;
      const side = m[1];
      const point = parseFloat(m[2]);
      const ownScore = side === "1" ? homeScore : awayScore;
      const oppScore = side === "1" ? awayScore : homeScore;
      const adjusted = ownScore + point;
      if (adjusted === oppScore) return "VOID"; // push — remboursé
      return adjusted > oppScore ? "WON" : "LOST";
    }
    case "TEAM_TOTALS": {
      const m = label.match(/^(.+) (Plus|Moins) ([\d.]+)$/);
      if (!m) return null;
      const [, team, dir, pointStr] = m;
      const line = parseFloat(pointStr);
      const teamScore = team === homeTeam ? homeScore : team === awayTeam ? awayScore : null;
      if (teamScore === null) return null;
      if (teamScore === line) return "VOID";
      return (dir === "Plus") === (teamScore > line) ? "WON" : "LOST";
    }
    default:
      return null; // FIRST_GOAL_SCORER, HALF_TIME_RESULT : non proposés à la vente, pas de calcul
  }
}
