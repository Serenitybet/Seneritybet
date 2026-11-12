import axios from "axios";
import { prisma } from "../lib/prisma";
import { updateCredits } from "../lib/credits.state";
import { settleTicket } from "./tpe.service";
import {
  fitLambdas, buildScoreGrid, devig, deriveLevel1Markets, splitHalfLambdas, deriveLevel2Markets,
  deriveMissingTotalLines, deriveMissingHandicapLines, deriveMissingTeamTotalLines,
  STANDARD_TOTAL_LINES, HALF_TOTAL_LINES, STANDARD_HANDICAP_LINES, HALF_HANDICAP_LINES,
  STANDARD_TEAM_TOTAL_LINES, HALF_TEAM_TOTAL_LINES,
} from "../lib/goal-model";
import { getSettingFloat, SETTING_KEYS } from "../lib/settings";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY;

// Marge globale sur les cotes — équivalent du RTP des jeux virtuels mais
// appliqué au PRIX plutôt qu'au résultat (qui reste réel, impossible à
// contrôler) — demande explicite du 04/11/2026. Lue une seule fois par
// cycle de sync (pas par cote) pour ne pas multiplier les requêtes DB, puis
// transmise aux fonctions d'upsert qui écrivent réellement les cotes.
// N'affecte PAS les marchés Niveau 1 (generateLevel1Markets) : ceux-ci
// recalculent leurs propres probabilités "justes" par devig avant de
// réappliquer leur propre marge (LEVEL1_MARGIN), donc une réduction en
// amont sur MATCH_WINNER/OVER_UNDER y est automatiquement neutralisée par
// le devig — pas un bug, juste hors du périmètre de ce réglage.
function applyMargin(rawPrice: number, marginPct: number): number {
  if (!marginPct) return rawPrice;
  return Math.round(rawPrice * (1 - marginPct / 100) * 100) / 100;
}

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

// Filet de sécurité en LECTURE, en plus du blocage déjà fait en ÉCRITURE
// (voir isQuarterLine ci-dessus, appliqué dans tous les upsert*) : la
// synchronisation ne crée/ne met plus à jour de ligne au quart, mais elle ne
// supprime jamais non plus les anciennes déjà en base (elle les ignore
// simplement). Un déploiement du correctif d'écriture en retard sur le cycle
// de sync peut donc laisser des lignes au quart fraîchement créées traîner
// en base jusqu'au prochain nettoyage manuel (vécu en prod le 21/10/2026).
// Ce filtre les masque systématiquement à l'affichage, quelle que soit leur
// origine ou leur ancienneté — aucune cote au quart ne peut plus être
// vendue, même en cas de nouvelle régression du même genre.
const QUARTER_LINE_LABEL_RE = /^(?:Plus|Moins) ([\d.]+)(?: (?:corners|cartons))?$|^[12] \(([+-]?[\d.]+)\)$/;
function isQuarterLineLabel(label: string): boolean {
  const m = label.match(QUARTER_LINE_LABEL_RE);
  if (!m) return false;
  const point = parseFloat(m[1] ?? m[2]);
  return !isNaN(point) && isQuarterLine(point);
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
  ODD_EVEN_TOTAL:            ["Pair", "Impair"],
  WINNING_MARGIN:            ["1 (1)", "1 (2)", "1 (3+)", "X", "2 (1)", "2 (2)", "2 (3+)"],
  HALF_TIME_FULL_TIME:       ["1/1", "1/X", "1/2", "X/1", "X/X", "X/2", "2/1", "2/X", "2/2"],
  HALF_TIME_CORRECT_SCORE:   ["0-0", "1-0", "0-1", "1-1", "2-0", "0-2", "2-1", "1-2"],
};

// Marchés dont le libellé commence par le nom de l'équipe (ex. "Lecce Oui",
// "Frosinone 3+") — le nom exact n'est pas connu à l'avance (dépend du
// match), donc pas de liste statique possible. On groupe par préfixe
// (l'équipe), en conservant l'ordre dans lequel chaque équipe apparaît en
// premier dans les données reçues, puis on trie chaque groupe selon l'ordre
// de suffixe fixe ci-dessous.
const TEAM_PREFIXED_SUFFIX_ORDER: Record<string, string[]> = {
  CLEAN_SHEET:        ["Oui", "Non"],
  WIN_TO_NIL:         ["Oui", "Non"],
  BOTH_HALVES_SCORE:  ["Oui", "Non"],
  TEAM_GOALS:         ["0", "1", "2", "3+"],
};

function sortTeamPrefixedOdds<T extends { label: string }>(odds: T[], suffixOrder: string[]): T[] {
  const suffixOf = (label: string) => suffixOrder.find((s) => label.endsWith(` ${s}`)) ?? "";
  const prefixOf = (label: string) => {
    const s = suffixOf(label);
    return s ? label.slice(0, label.length - s.length - 1) : label;
  };
  const prefixOrder: string[] = [];
  for (const o of odds) {
    const p = prefixOf(o.label);
    if (!prefixOrder.includes(p)) prefixOrder.push(p);
  }
  return [...odds].sort((a, b) => {
    const pa = prefixOrder.indexOf(prefixOf(a.label));
    const pb = prefixOrder.indexOf(prefixOf(b.label));
    if (pa !== pb) return pa - pb;
    return suffixOrder.indexOf(suffixOf(a.label)) - suffixOrder.indexOf(suffixOf(b.label));
  });
}

export function sortOddsByCanonicalOrder<T extends { label: string }>(marketType: string, odds: T[]): T[] {
  const filtered = odds.filter((o) => !isQuarterLineLabel(o.label));
  const teamSuffixOrder = TEAM_PREFIXED_SUFFIX_ORDER[marketType];
  if (teamSuffixOrder) return sortTeamPrefixedOdds(filtered, teamSuffixOrder);
  const order = ODD_LABEL_ORDER[marketType];
  if (!order) return filtered;
  return [...filtered].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

// ─── Ordre d'affichage canonique des marchés ───────────────────────────────
//
// Sans tri explicite, les marchés d'un même match s'affichaient dans
// l'ordre où ils avaient été créés en base (site public) ou triés par
// ordre alphabétique de leur nom (backoffice, "Cage inviolée" avant
// "Résultat (1X2)") — deux ordres différents, et aucun des deux ne mettait
// le marché principal en avant. Signalé en prod le 01/11/2026 : un seul
// ordre, partagé par le site ET le backoffice, marché principal (1X2)
// toujours en tête. Un type absent de cette liste retombe à la fin.
const MARKET_TYPE_DISPLAY_ORDER: string[] = [
  "MATCH_WINNER", "DOUBLE_CHANCE", "OVER_UNDER", "HANDICAP", "BOTH_TEAMS_SCORE",
  "DRAW_NO_BET", "CORRECT_SCORE", "HALF_TIME_RESULT", "HALF_TIME_FULL_TIME",
  "ODD_EVEN_TOTAL", "WINNING_MARGIN", "CLEAN_SHEET", "WIN_TO_NIL", "TEAM_GOALS",
  "TEAM_TOTALS", "FIRST_GOAL_SCORER", "ALTERNATE_TOTALS", "ALTERNATE_SPREADS",
  "FIRST_HALF_WINNER", "FIRST_HALF_TOTALS", "FIRST_HALF_HANDICAP", "FIRST_HALF_DOUBLE_CHANCE",
  "SECOND_HALF_WINNER", "SECOND_HALF_TOTALS", "SECOND_HALF_HANDICAP", "SECOND_HALF_DOUBLE_CHANCE",
  "HALF_TIME_CORRECT_SCORE", "BOTH_HALVES_SCORE",
  "CORNERS_TOTAL", "CORNERS_HANDICAP", "CARDS_TOTAL", "CARDS_HANDICAP",
  "SHOTS_ON_TARGET_TOTAL", "FOULS_TOTAL",
];

function marketTypeRank(type: string): number {
  const idx = MARKET_TYPE_DISPLAY_ORDER.indexOf(type);
  return idx === -1 ? MARKET_TYPE_DISPLAY_ORDER.length : idx;
}

/** Trie une liste de marchés dans l'ordre canonique ci-dessus — tri stable, exporté pour être réutilisé par les routes qui listent les marchés d'un match (site public et backoffice). */
export function sortMarketsByCanonicalOrder<T extends { type: string }>(markets: T[]): T[] {
  return [...markets].sort((a, b) => marketTypeRank(a.type) - marketTypeRank(b.type));
}

function sortEventMarketsOdds<T extends { markets: { type: string; odds: any[] }[] }>(event: T): T {
  return {
    ...event,
    markets: sortMarketsByCanonicalOrder(event.markets).map((m) => ({ ...m, odds: sortOddsByCanonicalOrder(m.type, m.odds) })),
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
  { key: "soccer_brazil_serie_b",                slug: "football", name: "Brasileirão Série B",  country: "Brazil",       icon: "⚽", sortOrder: 1 },
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
  // ⚽ Football — coupes nationales
  { key: "soccer_england_efl_cup",               slug: "football", name: "EFL Cup",              country: "England",      icon: "⚽", sortOrder: 1 },
  { key: "soccer_spain_copa_del_rey",            slug: "football", name: "Copa del Rey",         country: "Spain",        icon: "⚽", sortOrder: 1 },
  // ⚽ Football — compétitions internationales/continentales
  { key: "soccer_uefa_champs_league",            slug: "football", name: "Champions League",     country: "Europe",       icon: "⚽", sortOrder: 1 }, // 17. Ligue des Champions
  { key: "soccer_uefa_europa_league",            slug: "football", name: "Europa League",        country: "Europe",       icon: "⚽", sortOrder: 1 }, // 18. Europa League
  { key: "soccer_uefa_europa_conference_league", slug: "football", name: "Conference League",    country: "Europe",       icon: "⚽", sortOrder: 1 }, // 19. Conference League
  { key: "soccer_uefa_nations_league",           slug: "football", name: "UEFA Nations League",  country: "Europe",       icon: "⚽", sortOrder: 1 },
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
  // Hockey, football américain, MMA/boxe et baseball retirés (demande
  // explicite du 31/10/2026) : peu/pas demandés par les parieurs, leur
  // synchronisation (cotes + résultats, à chaque cycle, pour tous les
  // matchs) consommait des crédits TheOddsAPI pour rien. Seuls football,
  // basketball et tennis restent synchronisés. Les événements déjà en base
  // pour ces sports ne sont pas supprimés (tickets déjà émis à préserver),
  // ils arrêtent simplement de se mettre à jour — voir le backoffice pour
  // régler manuellement tout ticket encore en attente sur l'un d'eux.
];

export async function syncOddsFromAPI() {
  if (!API_KEY) {
    console.warn("ODDS_API_KEY non configurée, sync ignorée");
    return;
  }

  const marginPct = await getSettingFloat(SETTING_KEYS.ODDS_MARGIN_PCT);
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
        await upsertEvent(competition.id, game, config.slug, marginPct);
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

// Fenêtre de détection d'une reprogrammation : TheOddsAPI réémet parfois un
// nouvel externalId pour un match déjà en base quand son horaire change
// (ex. décalage TV) — sans détection, upsertEvent créerait un second Event
// en doublon pour la même rencontre, laissant l'ancien orphelin avec un ID
// mort (jamais revisité, 404 en boucle sur les cotes additionnelles — voir
// l'incident Hibernian/Celtic du 21/10/2026) ET affichant les deux dates
// aux parieurs. Pire : un ticket déjà émis sur l'ancien ID resterait lié à
// un match fantôme au lieu de suivre le match réel. 3 jours couvre les
// décalages TV réalistes (observé : 22h) sans risquer de fusionner à tort
// deux vraies rencontres aller/retour entre les mêmes équipes (toujours
// espacées de plusieurs semaines).
const RESCHEDULE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

async function upsertEvent(competitionId: string, game: any, sportSlug = "football", marginPct = 0) {
  const commenceTime = new Date(game.commence_time);
  let existing = await prisma.event.findUnique({ where: { externalId: game.id } });
  let rescheduleMerge = false;

  if (!existing) {
    existing = await prisma.event.findFirst({
      where: {
        competitionId,
        homeTeam:   game.home_team,
        awayTeam:   game.away_team,
        status:     "UPCOMING",
        externalId: { not: game.id },
        startTime:  {
          gte: new Date(commenceTime.getTime() - RESCHEDULE_WINDOW_MS),
          lte: new Date(commenceTime.getTime() + RESCHEDULE_WINDOW_MS),
        },
      },
    });
    if (existing) {
      rescheduleMerge = true;
      console.log(`🔁 Reprogrammation détectée : ${game.home_team} vs ${game.away_team} (ancien ID ${existing.externalId} → ${game.id})`);
    }
  }

  const event = existing
    ? await prisma.event.update({
        where: { id: existing.id },
        data: {
          externalId: game.id,
          homeTeam:   game.home_team,
          awayTeam:   game.away_team,
          startTime:  commenceTime,
          // L'ancien ID est mort, les marchés additionnels (BTTS, mi-temps,
          // corners...) doivent être rapatriés sous le nouveau — sans ça ils
          // resteraient figés au dernier état connu de l'ancien match, ou
          // jamais retentés s'ils avaient déjà échoué. On ne fait ça QUE sur
          // une fusion de reprogrammation : remettre ces versions à 0 à
          // chaque sync normal (externalId inchangé) gaspillerait des
          // crédits en re-synchronisant tous les matchs à chaque cycle.
          ...(rescheduleMerge ? { extraMarketsVersion: 0, propMarketsVersion: 0, halfMarketsVersion: 0, basketballHalfMarketsVersion: 0, tennisSetMarketsVersion: 0 } : {}),
        },
      })
    : await prisma.event.create({
        data: {
          competitionId,
          externalId: game.id,
          homeTeam:   game.home_team,
          awayTeam:   game.away_team,
          startTime:  commenceTime,
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
        const point = Number(outcome.point);
        if (isQuarterLine(point)) continue; // non réglable automatiquement — voir isQuarterLine
        label = `${outcome.name === "Over" ? "Plus" : "Moins"} ${point}`;
      } else {
        label = outcome.name === game.home_team ? "1"
          : outcome.name === game.away_team ? "2"
          : outcome.name === "Draw" ? "X"
          : outcome.name;
      }

      const value = applyMargin(outcome.price, marginPct);
      const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
      if (existing) {
        await prisma.odd.update({ where: { id: existing.id }, data: { value } });
      } else {
        await prisma.odd.create({ data: { marketId: market.id, label, value } });
      }
    }
  }

  // Marchés "Niveau 1" générés automatiquement à partir des vraies cotes
  // 1X2/Plus-Moins qu'on vient de synchroniser — football uniquement (le
  // modèle de buts de Poisson n'a pas de sens pour le tennis/basket/MMA).
  // Isolé dans son propre try/catch : une anomalie sur ce calcul ne doit
  // jamais empêcher la synchronisation des marchés "normaux" du reste du
  // cycle (voir le même principe appliqué partout ailleurs dans ce fichier).
  if (sportSlug === "football") {
    try {
      await generateLevel1Markets(event.id, event.homeTeam, event.awayTeam);
    } catch (err) {
      console.warn(`⚠️  Génération cotes Niveau 1 — échec pour ${event.homeTeam} vs ${event.awayTeam} :`, err);
    }
    if (!event.manualMarketStubsCreated) {
      try {
        await ensureManualMarketStubs(event.id);
      } catch (err) {
        console.warn(`⚠️  Marchés manuels vides — échec pour ${event.homeTeam} vs ${event.awayTeam} :`, err);
      }
    }
  }
}

// ─── Marchés "manuels" pré-créés vides — demande explicite du 04/11/2026 ───────
//
// Aucun de ces marchés n'est fourni par TheOddsAPI ni réglable
// automatiquement. Plutôt que d'attendre qu'un trader les crée lui-même sur
// chaque match (type par type), ils sont créés VIDES (sans aucune cote) dès
// la synchronisation du match, pour qu'il n'ait plus qu'à y ajouter les
// cotes trouvées ailleurs (bouton "Ajouter une cote", déjà en place côté
// backoffice) puis publier — le marché reste en brouillon (isPublished
// false, invisible site/TPE) tant qu'il est vide, comme tout marché créé
// manuellement.
//
// FIRST_HALF_PENALTY/SECOND_HALF_PENALTY restent manuels : un penalty accordé
// n'est pas un évènement dérivable du nombre de buts attendu, aucune formule
// ni flux TheOddsAPI ne le couvre. Les 11 autres marchés qui étaient ici
// (DOUBLE_CHANCE_BTTS, RESULT_BTTS, RESULT_TOTAL, DOUBLE_CHANCE_TOTAL,
// FIRST_HALF_TEAM_TOTALS, SECOND_HALF_TEAM_TOTALS, FIRST_HALF_ODD_EVEN,
// SECOND_HALF_ODD_EVEN, HIGHEST_SCORING_HALF, BTTS_BOTH_HALVES,
// WIN_BOTH_HALVES) sont désormais générés et publiés automatiquement par
// generateLevel2Markets (voir plus bas) — retirés d'ici le 05/11/2026 pour
// ne plus être (re)créés vides en attente de saisie manuelle.
const MANUAL_MARKET_STUBS: { type: string; name: string }[] = [
  { type: "FIRST_HALF_PENALTY",      name: "Penalty accordé — 1ère mi-temps" },
  { type: "SECOND_HALF_PENALTY",     name: "Penalty accordé — 2nde mi-temps" },
  // BOTH_HALVES_SCORE ("Équipe marque à chaque mi-temps") existe déjà comme
  // type de marché (créable manuellement) mais n'était jusqu'ici jamais
  // pré-créé sur les matchs — ajouté à la liste pour la même raison que les
  // nouveaux ci-dessus.
  { type: "BOTH_HALVES_SCORE",       name: "Équipe marque à chaque mi-temps" },
];

async function ensureManualMarketStubs(eventId: string) {
  for (const stub of MANUAL_MARKET_STUBS) {
    const existing = await prisma.market.findFirst({ where: { eventId, type: stub.type as any } });
    if (!existing) {
      await prisma.market.create({ data: { eventId, name: stub.name, type: stub.type as any, isPublished: false } });
    }
  }
  await prisma.event.update({ where: { id: eventId }, data: { manualMarketStubsCreated: true } });
}

const LEVEL1_MARGIN = 0.07; // marge bookmaker ~7%, cohérente avec les cotes réelles observées
const LEVEL1_MARKET_NAMES: Record<string, string> = {
  ODD_EVEN_TOTAL: "Total de buts pair/impair",
  CLEAN_SHEET:    "Cage inviolée",
  WIN_TO_NIL:     "Victoire à zéro",
  WINNING_MARGIN: "Marge de victoire",
  TEAM_GOALS:     "Buts par équipe (exact)",
};
const LEVEL2_MARKET_NAMES: Record<string, string> = {
  DOUBLE_CHANCE_BTTS:      "Double chance et les deux équipes marquent",
  RESULT_BTTS:             "Résultat et les deux équipes marquent",
  RESULT_TOTAL:            "Résultat et total de buts (2.5)",
  DOUBLE_CHANCE_TOTAL:     "Double chance et total de buts (2.5)",
  FIRST_HALF_TEAM_TOTALS:  "Totaux par équipe — 1ère mi-temps",
  SECOND_HALF_TEAM_TOTALS: "Totaux par équipe — 2nde mi-temps",
  FIRST_HALF_ODD_EVEN:     "Total buts pair/impair — 1ère mi-temps",
  SECOND_HALF_ODD_EVEN:    "Total buts pair/impair — 2nde mi-temps",
  HIGHEST_SCORING_HALF:    "Mi-temps avec le plus de buts",
  BTTS_BOTH_HALVES:        "Les deux équipes marquent dans chaque mi-temps",
  WIN_BOTH_HALVES:         "Équipe gagnante des deux mi-temps",
};

/**
 * Crée/actualise les marchés d'un groupe "dérivé" (Niveau 1 ou Niveau 2) à
 * partir des cotes calculées par le modèle de buts. Republie aussi, en
 * passant, un marché qui existait déjà en brouillon vide (ex. un des 11
 * marchés manuels repris automatiquement le 05/11/2026) — sans ça il
 * resterait invisible malgré ses nouvelles cotes.
 */
async function upsertDerivedMarkets(eventId: string, derivedMarkets: Record<string, { label: string; value: number }[]>, names: Record<string, string>) {
  for (const [marketType, odds] of Object.entries(derivedMarkets)) {
    let market = await prisma.market.findFirst({ where: { eventId, type: marketType as any }, include: { odds: true } });
    if (!market) {
      market = await prisma.market.create({ data: { eventId, type: marketType as any, name: names[marketType] }, include: { odds: true } });
    } else if (!market.isPublished) {
      await prisma.market.update({ where: { id: market.id }, data: { isPublished: true } });
    }
    const currentLabels = new Set(odds.map((o) => o.label));
    for (const { label, value } of odds) {
      const existingOdd = market.odds.find((o) => o.label === label);
      if (existingOdd) {
        await prisma.odd.update({ where: { id: existingOdd.id }, data: { value, isActive: true } });
      } else {
        await prisma.odd.create({ data: { marketId: market.id, label, value } });
      }
    }
    // Désactive les anciennes cotes dont le libellé ne correspond plus au
    // format actuel (ex. le format de WIN_TO_NIL est passé de "1"/"2"/"Non"
    // à "<équipe> Oui"/"<équipe> Non") — sans ça elles resteraient affichées
    // en orphelines, jamais mises à jour. Désactivation plutôt que
    // suppression : préserve l'intégrité référentielle si un ticket y fait
    // déjà référence.
    const stale = market.odds.filter((o) => o.isActive && !currentLabels.has(o.label));
    for (const o of stale) {
      await prisma.odd.update({ where: { id: o.id }, data: { isActive: false } });
    }
  }
}

/**
 * Déduit (λ_domicile, λ_extérieur) des vraies cotes MATCH_WINNER + OVER_UNDER
 * déjà en base pour cet évènement, puis génère/actualise les 5 marchés
 * "Niveau 1" ainsi que les 11 marchés "Niveau 2" (combinés + par mi-temps) —
 * voir lib/goal-model.ts pour le détail du modèle. Ne fait rien si l'une des
 * deux cotes de base manque encore (ex. bookmaker n'ayant pas publié de
 * ligne Plus/Moins pour ce match).
 */
async function generateLevel1Markets(eventId: string, homeTeam: string, awayTeam: string) {
  const winnerMarket = await prisma.market.findFirst({ where: { eventId, type: "MATCH_WINNER" }, include: { odds: true } });
  const totalsMarket = await prisma.market.findFirst({ where: { eventId, type: "OVER_UNDER" }, include: { odds: true } });
  if (!winnerMarket || !totalsMarket) return;

  const o1 = winnerMarket.odds.find((o) => o.label === "1");
  const oX = winnerMarket.odds.find((o) => o.label === "X");
  const o2 = winnerMarket.odds.find((o) => o.label === "2");
  if (!o1 || !oX || !o2) return;

  // Cherche une ligne Plus/Moins où les deux côtés sont publiés (n'importe
  // quelle ligne fait l'affaire pour ancrer le total de buts attendu).
  let overLine: number | null = null, overVal: number | null = null, underVal: number | null = null;
  for (const odd of totalsMarket.odds) {
    const m = odd.label.match(/^Plus ([\d.]+)$/);
    if (!m) continue;
    const underOdd = totalsMarket.odds.find((o) => o.label === `Moins ${m[1]}`);
    if (underOdd) { overLine = parseFloat(m[1]); overVal = Number(odd.value); underVal = Number(underOdd.value); break; }
  }
  if (overLine === null || overVal === null || underVal === null) return;

  const [p1, pX, p2] = devig([Number(o1.value), Number(oX.value), Number(o2.value)]);
  const [pOver] = devig([overVal, underVal]);

  const { lambdaHome, lambdaAway } = fitLambdas(p1, pX, p2, overLine, pOver);
  const grid = buildScoreGrid(lambdaHome, lambdaAway);
  await upsertDerivedMarkets(eventId, deriveLevel1Markets(grid, homeTeam, awayTeam, LEVEL1_MARGIN), LEVEL1_MARKET_NAMES);

  const { lambdaHomeH1, lambdaAwayH1, lambdaHomeH2, lambdaAwayH2 } = splitHalfLambdas(lambdaHome, lambdaAway);
  const gridH1 = buildScoreGrid(lambdaHomeH1, lambdaAwayH1);
  const gridH2 = buildScoreGrid(lambdaHomeH2, lambdaAwayH2);
  await upsertDerivedMarkets(eventId, deriveLevel2Markets(grid, gridH1, gridH2, homeTeam, awayTeam, LEVEL1_MARGIN), LEVEL2_MARKET_NAMES);

  // Complète Plus/Moins, handicap et totaux par équipe manquants — plein
  // match ET par mi-temps (demande explicite du 12/11/2026, suite du
  // correctif Plus/Moins du 12/11 : mêmes trous possibles sur le handicap
  // et les totaux par équipe, plein match et par mi-temps).
  await fillTotalsGap(eventId, ["OVER_UNDER", "ALTERNATE_TOTALS"], "ALTERNATE_TOTALS", "Plus/Moins (autres lignes)", grid, STANDARD_TOTAL_LINES);
  await fillTotalsGap(eventId, ["FIRST_HALF_TOTALS"],  "FIRST_HALF_TOTALS",  "Plus/Moins 1ère mi-temps", gridH1, HALF_TOTAL_LINES);
  await fillTotalsGap(eventId, ["SECOND_HALF_TOTALS"], "SECOND_HALF_TOTALS", "Plus/Moins 2nde mi-temps", gridH2, HALF_TOTAL_LINES);

  await fillHandicapGap(eventId, ["HANDICAP", "ALTERNATE_SPREADS"], "ALTERNATE_SPREADS", "Handicap (autres lignes)", grid, STANDARD_HANDICAP_LINES);
  await fillHandicapGap(eventId, ["FIRST_HALF_HANDICAP"],  "FIRST_HALF_HANDICAP",  "Handicap 1ère mi-temps", gridH1, HALF_HANDICAP_LINES);
  await fillHandicapGap(eventId, ["SECOND_HALF_HANDICAP"], "SECOND_HALF_HANDICAP", "Handicap 2nde mi-temps", gridH2, HALF_HANDICAP_LINES);

  await fillTeamTotalsGap(eventId, "TEAM_TOTALS", "Totaux par équipe", grid, homeTeam, awayTeam, STANDARD_TEAM_TOTAL_LINES);
  await fillTeamTotalsGap(eventId, "FIRST_HALF_TEAM_TOTALS",  "Totaux par équipe — 1ère mi-temps", gridH1, homeTeam, awayTeam, HALF_TEAM_TOTAL_LINES);
  await fillTeamTotalsGap(eventId, "SECOND_HALF_TEAM_TOTALS", "Totaux par équipe — 2nde mi-temps", gridH2, homeTeam, awayTeam, HALF_TEAM_TOTAL_LINES);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Complète les lignes Plus/Moins manquantes dans `writeType` — en comptant
 * comme "déjà couvertes" toutes les lignes trouvées dans `checkTypes` (le
 * marché principal + ses alternatives, le cas échéant). Ne touche jamais
 * une ligne déjà fournie par l'API, même approximative — dès que le sync
 * correspondant en reçoit une vraie pour cette ligne, elle prend le dessus
 * au cycle suivant (mise à jour par libellé, pas de doublon).
 */
async function fillTotalsGap(
  eventId: string, checkTypes: string[], writeType: string, writeName: string,
  grid: ReturnType<typeof buildScoreGrid>, lines: number[],
) {
  const markets = await prisma.market.findMany({ where: { eventId, type: { in: checkTypes as any } }, include: { odds: true } });
  const existingLines: number[] = [];
  for (const m of markets) for (const odd of m.odds) {
    const match = odd.label.match(/^(?:Plus|Moins)\s+([\d.]+)$/);
    if (match) existingLines.push(parseFloat(match[1]));
  }

  const missing = deriveMissingTotalLines(grid, existingLines, LEVEL1_MARGIN, lines);
  if (missing.length === 0) return;

  const target = markets.find((m: { type: string }) => m.type === writeType)
    ?? await prisma.market.create({ data: { eventId, type: writeType as any, name: writeName }, include: { odds: true } });
  for (const { label, value } of missing) {
    if (target.odds.find((o: { label: string }) => o.label === label)) continue;
    await prisma.odd.create({ data: { marketId: target.id, label, value } });
  }
}

/** Même principe que fillTotalsGap, pour le handicap asiatique ("1 (+X)" / "2 (-X)"). */
async function fillHandicapGap(
  eventId: string, checkTypes: string[], writeType: string, writeName: string,
  grid: ReturnType<typeof buildScoreGrid>, lines: number[],
) {
  const markets = await prisma.market.findMany({ where: { eventId, type: { in: checkTypes as any } }, include: { odds: true } });
  const existingLines: number[] = [];
  for (const m of markets) for (const odd of m.odds) {
    const match = odd.label.match(/^[12]\s*\(([+-]?[\d.]+)\)$/);
    if (match) existingLines.push(Math.abs(parseFloat(match[1])));
  }

  const missing = deriveMissingHandicapLines(grid, existingLines, LEVEL1_MARGIN, lines);
  if (missing.length === 0) return;

  const target = markets.find((m: { type: string }) => m.type === writeType)
    ?? await prisma.market.create({ data: { eventId, type: writeType as any, name: writeName }, include: { odds: true } });
  for (const { label, value } of missing) {
    if (target.odds.find((o: { label: string }) => o.label === label)) continue;
    await prisma.odd.create({ data: { marketId: target.id, label, value } });
  }
}

/** Même principe pour les totaux par équipe ("<équipe> Plus/Moins X"), une équipe à la fois. */
async function fillTeamTotalsGap(
  eventId: string, marketType: string, marketName: string,
  grid: ReturnType<typeof buildScoreGrid>, homeTeam: string, awayTeam: string, lines: number[],
) {
  const market = await prisma.market.findFirst({ where: { eventId, type: marketType as any }, include: { odds: true } });
  const linesFor = (team: string): number[] => {
    const re = new RegExp(`^${escapeRegExp(team)} (?:Plus|Moins) ([\\d.]+)$`);
    const found: number[] = [];
    for (const o of market?.odds ?? []) { const m = o.label.match(re); if (m) found.push(parseFloat(m[1])); }
    return found;
  };

  const missing = [
    ...deriveMissingTeamTotalLines(grid, homeTeam, true,  linesFor(homeTeam), LEVEL1_MARGIN, lines),
    ...deriveMissingTeamTotalLines(grid, awayTeam, false, linesFor(awayTeam), LEVEL1_MARGIN, lines),
  ];
  if (missing.length === 0) return;

  const target = market
    ?? await prisma.market.create({ data: { eventId, type: marketType as any, name: marketName }, include: { odds: true } });
  for (const { label, value } of missing) {
    if (target.odds.find((o: { label: string }) => o.label === label)) continue;
    await prisma.odd.create({ data: { marketId: target.id, label, value } });
  }
}

// ─── Marchés additionnels (BTTS, double chance) — tous les championnats ───────
//
// Ces marchés ne sont disponibles que via l'endpoint par match (pas par
// championnat), donc 1 appel = 1 match au lieu de 1 appel = 1 championnat.
// Fenêtre alignée sur la fenêtre d'affichage du site (J0 à J+14, demande
// explicite du 01/11/2026 — un match affiché à J+10 n'avait jusqu'ici que
// le strict minimum de marchés, faute d'être encore dans cette fenêtre) :
// les parieurs doivent pouvoir composer des combinés sur les 14 jours
// affichés avec les mêmes options, pas seulement sur les matchs des 48h à
// venir. Le coût réel (quelques milliers de crédits pour couvrir tout le
// calendrier des deux semaines, sur 100 000/mois) ne justifie pas d'étaler
// la couverture sur plusieurs heures :
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
const EXTRA_MARKETS_VERSION = 8; // v1: btts+double_chance ; v2: + correct_score, draw_no_bet, alternate_totals ; v3: fix libellé double chance + plus/moins à 6 lignes ; v4: plus/moins alternatif limité aux lignes X.5 ; v5: + handicap alternatif ; v6: + totaux par équipe ; v7: fix plus/moins alternatif laissait passer les lignes au quart (3.75, 4.25) ; v8: + alternate_team_totals fusionné dans TEAM_TOTALS (plus de lignes par équipe — demande explicite du 01/11/2026)

export async function syncExtraMarkets() {
  if (!API_KEY) return;

  const marginPct = await getSettingFloat(SETTING_KEYS.ODDS_MARGIN_PCT);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 14);

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
            markets:    "btts,double_chance,correct_score,draw_no_bet,alternate_totals,alternate_spreads,team_totals,alternate_team_totals",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertExtraMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? [], marginPct);
      await prisma.event.update({ where: { id: event.id }, data: { extraMarketsVersion: EXTRA_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422 (pas de données additionnelles pour ce match) ou autre erreur : on ignore et on continue,
      // mais on logue pour pouvoir diagnostiquer un échec répété sur un match précis.
      console.warn(`⚠️  Marchés additionnels — échec pour ${event.homeTeam} vs ${event.awayTeam} : ${err.response?.status ?? "?"} ${JSON.stringify(err.response?.data ?? err.message)}`);
      // 404/422 = l'event n'existe plus ou pas valide côté TheOddsAPI (externalId
      // périmé) — une erreur définitive, pas une panne temporaire. Sans ça, ce
      // match est retenté à l'infini à chaque cycle, pour toujours (vu en prod
      // avec un externalId obsolète), gaspillant des crédits sans jamais réussir.
      // On marque donc comme traité pour arrêter les tentatives.
      if (err.response?.status === 404 || err.response?.status === 422) {
        await prisma.event.update({ where: { id: event.id }, data: { extraMarketsVersion: EXTRA_MARKETS_VERSION } }).catch(() => {});
      }
    }
  }

  if (synced > 0) console.log(`🎯 Marchés additionnels (BTTS, double chance, score exact, remboursé si nul, plus/moins alternatif, handicap alternatif, totaux par équipe élargis) : ${synced} match(s) synchronisés`);
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

// alternate_team_totals ("toutes les lignes disponibles") complète team_totals
// ("ligne vedette") plutôt que de la remplacer — fusionné dans la clé
// team_totals AVANT le traitement principal (qui ne garde qu'une seule clé
// par type de marché, voir seenTypes plus bas), pour que les deux
// contribuent ensemble au même marché TEAM_TOTALS au lieu de s'exclure.
function mergeAlternateTeamTotals(bookmakers: any[]) {
  for (const bookmaker of bookmakers) {
    const markets = bookmaker.markets ?? [];
    const featured  = markets.find((m: any) => m.key === "team_totals");
    const alternate = markets.find((m: any) => m.key === "alternate_team_totals");
    if (!alternate) continue;
    if (featured) {
      const seen = new Set(featured.outcomes.map((o: any) => `${o.description}|${o.point}|${o.name}`));
      for (const o of alternate.outcomes) {
        const key = `${o.description}|${o.point}|${o.name}`;
        if (!seen.has(key)) { featured.outcomes.push(o); seen.add(key); }
      }
    } else {
      // Pas de ligne vedette chez ce bookmaker : alternate_team_totals devient
      // directement la source du marché.
      alternate.key = "team_totals";
    }
    bookmaker.markets = markets.filter((m: any) => m.key !== "alternate_team_totals");
  }
}

async function upsertExtraMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[], marginPct = 0) {
  mergeAlternateTeamTotals(bookmakers);
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

        const value = applyMargin(outcome.price, marginPct);
        const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
        if (existing) {
          await prisma.odd.update({ where: { id: existing.id }, data: { value } });
        } else {
          await prisma.odd.create({ data: { marketId: market.id, label, value } });
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
// Mêmes cartes pour basketball (syncBasketballHalfMarkets) et tennis
// (syncTennisSetMarkets) ci-dessous — demande explicite du 01/11/2026.
const BASKETBALL_SPORT_KEY_BY_COMPETITION_NAME: Record<string, string> = Object.fromEntries(
  SPORTS_CONFIG.filter((c) => c.slug === "basketball").map((c) => [c.name, c.key]),
);
const TENNIS_SPORT_KEY_BY_COMPETITION_NAME: Record<string, string> = Object.fromEntries(
  SPORTS_CONFIG.filter((c) => c.slug === "tennis").map((c) => [c.name, c.key]),
);
const PROP_MARKETS_LIMIT = 600;
const PROP_MARKETS_VERSION = 2; // v2: + BTTS 1ère mi-temps, score exact à la mi-temps, mi-temps/fin de match, corners 1X2 (demande explicite du 01/11/2026 : utiliser toutes les options proposées par TheOddsAPI)

export async function syncPropMarkets() {
  if (!API_KEY) return;

  const marginPct = await getSettingFloat(SETTING_KEYS.ODDS_MARGIN_PCT);
  // Fenêtre étendue à J+14 (comme syncExtraMarkets ci-dessus) — demande
  // explicite du 01/11/2026.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 14);

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
            markets:    "h2h_h1,h2h_h2,alternate_totals_corners,alternate_spreads_corners,alternate_totals_cards,alternate_spreads_cards,btts_h1,correct_score_h1,halftime_fulltime,corners_1x2",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertPropMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? [], marginPct);
      await prisma.event.update({ where: { id: event.id }, data: { propMarketsVersion: PROP_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422 (marché non proposé pour ce match, ou clé invalide) ou autre erreur : on ignore et on continue,
      // mais on logue pour pouvoir diagnostiquer un échec répété sur un match précis.
      console.warn(`⚠️  Marchés stats — échec pour ${event.homeTeam} vs ${event.awayTeam} : ${err.response?.status ?? "?"} ${JSON.stringify(err.response?.data ?? err.message)}`);
      // 404/422 = event inexistant/invalide côté TheOddsAPI — définitif, pas une
      // panne temporaire (voir syncExtraMarkets) : on marque comme traité pour
      // ne pas retenter à l'infini.
      if (err.response?.status === 404 || err.response?.status === 422) {
        await prisma.event.update({ where: { id: event.id }, data: { propMarketsVersion: PROP_MARKETS_VERSION } }).catch(() => {});
      }
    }
  }

  if (synced > 0) console.log(`🥅 Marchés stats (1ère/2nde mi-temps, corners, cartons, BTTS 1MT, score exact 1MT, mi-temps/fin de match, corners 1X2) : ${synced} match(s) synchronisés`);
}

const PROP_MARKET_TYPE_BY_KEY: Record<string, string> = {
  h2h_h1:                     "FIRST_HALF_WINNER",
  h2h_h2:                     "SECOND_HALF_WINNER",
  alternate_totals_corners:   "CORNERS_TOTAL",
  alternate_spreads_corners:  "CORNERS_HANDICAP",
  alternate_totals_cards:     "CARDS_TOTAL",
  alternate_spreads_cards:    "CARDS_HANDICAP",
  btts_h1:                    "BOTH_TEAMS_SCORE_FIRST_HALF",
  correct_score_h1:           "HALF_TIME_CORRECT_SCORE",
  halftime_fulltime:          "HALF_TIME_FULL_TIME",
  corners_1x2:                "CORNERS_1X2",
};

const PROP_TOTALS_MAX_LINES  = 6;
const PROP_SPREADS_MAX_LINES = 6;

async function upsertPropMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[], marginPct = 0) {
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
        apiMarket.key === "alternate_spreads_cards"   ? "Handicap cartons" :
        apiMarket.key === "btts_h1"                   ? "Les deux équipes marquent (1ère mi-temps)" :
        apiMarket.key === "correct_score_h1"          ? "Score exact à la mi-temps" :
        apiMarket.key === "halftime_fulltime"         ? "Mi-temps / Fin de match" :
        "Corners (1X2)";

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
        // Lignes au quart exclues — voir isQuarterLine — y compris dans le
        // repli sur "toutes les lignes" quand aucune ligne à la demie n'existe.
        const allPoints = [...new Set(outcomes.map((o: any) => o.point))]
          .filter((p): p is number => typeof p === "number" && !isQuarterLine(p));
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
        } else if (apiMarket.key === "alternate_spreads_corners" || apiMarket.key === "alternate_spreads_cards") {
          const side = outcome.name === homeTeam ? "1" : outcome.name === awayTeam ? "2" : outcome.name;
          const point = Number(outcome.point);
          label = `${side} (${point >= 0 ? "+" : ""}${point})`;
        } else if (apiMarket.key === "btts_h1") {
          label = outcome.name === "Yes" ? "Oui" : "Non";
        } else if (apiMarket.key === "correct_score_h1") {
          // Même format que correct_score plein match (voir syncExtraMarkets) :
          // "Équipe1:0|Équipe2:0" → "0-0".
          const [homePart, awayPart] = String(outcome.name).split("|");
          const homeGoals = homePart?.split(":").pop()?.trim();
          const awayGoals = awayPart?.split(":").pop()?.trim();
          label = homeGoals !== undefined && awayGoals !== undefined ? `${homeGoals}-${awayGoals}` : outcome.name;
        } else if (apiMarket.key === "halftime_fulltime") {
          // Format TheOddsAPI : "Équipe/Équipe" (meneur à la mi-temps / vainqueur
          // au score final), chaque partie étant soit un nom d'équipe soit "Draw"
          // — converti en notation 1/X/2 (ex. "1/1", "X/2").
          const toCode = (part: string) =>
            part === homeTeam ? "1" : part === awayTeam ? "2" : part === "Draw" ? "X" : part;
          const [htPart, ftPart] = String(outcome.name).split("/");
          label = htPart !== undefined && ftPart !== undefined ? `${toCode(htPart)}/${toCode(ftPart)}` : outcome.name;
        } else {
          // corners_1x2 : équipe avec le plus de corners (ou égalité)
          label = outcome.name === homeTeam ? "1" : outcome.name === awayTeam ? "2" : outcome.name === "Draw" ? "X" : outcome.name;
        }

        const value = applyMargin(outcome.price, marginPct);
        const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
        if (existing) {
          await prisma.odd.update({ where: { id: existing.id }, data: { value } });
        } else {
          await prisma.odd.create({ data: { marketId: market.id, label, value } });
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
const HALF_MARKETS_VERSION = 2; // v2: totaux/handicap mi-temps n'étaient plus filtrés qu'aux lignes X.5/positives, vidant la section quand seules des lignes entières ou la ligne 0 étaient offertes

export async function syncHalfMarkets() {
  if (!API_KEY) return;

  const marginPct = await getSettingFloat(SETTING_KEYS.ODDS_MARGIN_PCT);
  // Fenêtre étendue à J+14 (comme syncExtraMarkets/syncPropMarkets) — demande
  // explicite du 01/11/2026.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 14);

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

      await upsertHalfMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? [], marginPct);
      await prisma.event.update({ where: { id: event.id }, data: { halfMarketsVersion: HALF_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      // 422 (marché non proposé pour ce match, ou clé invalide) ou autre erreur : on ignore et on continue,
      // mais on logue pour pouvoir diagnostiquer un échec répété sur un match précis.
      console.warn(`⚠️  Marchés mi-temps — échec pour ${event.homeTeam} vs ${event.awayTeam} : ${err.response?.status ?? "?"} ${JSON.stringify(err.response?.data ?? err.message)}`);
      // 404/422 = event inexistant/invalide côté TheOddsAPI — définitif, pas une
      // panne temporaire (voir syncExtraMarkets) : on marque comme traité pour
      // ne pas retenter à l'infini.
      if (err.response?.status === 404 || err.response?.status === 422) {
        await prisma.event.update({ where: { id: event.id }, data: { halfMarketsVersion: HALF_MARKETS_VERSION } }).catch(() => {});
      }
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

async function upsertHalfMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[], marginPct = 0) {
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
        // Contrairement au marché plein-match (qui a toujours une ligne de
        // référence non filtrée en plus de ses alternatives), la mi-temps
        // n'a QUE ce marché : se restreindre aux lignes X.5 uniquement (comme
        // pour les alternatives plein-match) laissait la section totalement
        // vide dès qu'un bookmaker n'offrait que des lignes entières pour un
        // total aussi bas (0, 1 but) — fréquent en 1ère mi-temps. On garde
        // donc entières ET demies, en n'excluant que les lignes au quart
        // (non réglables — voir isQuarterLine).
        const points = [...new Set(outcomes.map((o: any) => o.point))]
          .filter((p): p is number => typeof p === "number" && !isQuarterLine(p))
          .sort((a, b) => a - b)
          .slice(0, HALF_TOTALS_MAX_LINES);
        outcomes = outcomes.filter((o: any) => points.includes(o.point));
      } else if (apiMarket.key === "spreads_h1" || apiMarket.key === "spreads_h2") {
        // Même raisonnement + inclut la ligne 0 (pick'em) exclue à tort par
        // "p > 0" — en 1ère/2nde mi-temps (score souvent serré), c'est
        // fréquemment la SEULE ligne de handicap proposée, donc l'exclure
        // vidait entièrement la section au lieu de ne retirer qu'un doublon.
        const absPoints = [...new Set(outcomes.map((o: any) => Math.abs(o.point)))]
          .filter((p): p is number => typeof p === "number" && p >= 0 && !isQuarterLine(p))
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

        const value = applyMargin(outcome.price, marginPct);
        const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
        if (existing) {
          await prisma.odd.update({ where: { id: existing.id }, data: { value } });
        } else {
          await prisma.odd.create({ data: { marketId: market.id, label, value } });
        }
      }
    }
  }
}

// ─── Marchés "mi-temps" — basketball ──────────────────────────────────────────
//
// Même famille que syncHalfMarkets (plus/moins, handicap par mi-temps), mais
// SANS double_chance_h1/h2 (pas de match nul au basket, la clé ne renverrait
// jamais rien — inutile de payer les crédits pour la demander). Réutilise
// directement upsertHalfMarkets/HALF_MARKET_TYPE_BY_KEY ci-dessus : les clés
// totals_h1/h2 et spreads_h1/h2 sont déjà génériques (basées sur les noms
// d'équipe, rien de spécifique au football). Lot et version séparés de
// syncHalfMarkets (basketballHalfMarketsVersion) bien que les deux
// compétitions soient disjointes, pour ne jamais faire re-synchroniser l'un
// quand l'autre change de version — demande explicite du 01/11/2026.
const BASKETBALL_HALF_MARKETS_LIMIT = 300;
const BASKETBALL_HALF_MARKETS_VERSION = 1;

export async function syncBasketballHalfMarkets() {
  if (!API_KEY) return;

  const marginPct = await getSettingFloat(SETTING_KEYS.ODDS_MARGIN_PCT);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 14);

  const events = await prisma.event.findMany({
    where: {
      status: { in: ["UPCOMING", "LIVE"] },
      startTime: { gte: new Date(), lte: cutoff },
      competition: { name: { in: Object.keys(BASKETBALL_SPORT_KEY_BY_COMPETITION_NAME) } },
      basketballHalfMarketsVersion: { lt: BASKETBALL_HALF_MARKETS_VERSION },
    },
    include: { competition: true },
    orderBy: { startTime: "asc" },
    take: BASKETBALL_HALF_MARKETS_LIMIT,
  });

  let synced = 0;
  for (const event of events) {
    const sportKey = BASKETBALL_SPORT_KEY_BY_COMPETITION_NAME[event.competition.name];
    if (!sportKey || !event.externalId) continue;

    try {
      const res = await axios.get(
        `${ODDS_API_BASE}/sports/${sportKey}/events/${event.externalId}/odds`,
        {
          params: {
            apiKey:     API_KEY,
            regions:    "eu",
            markets:    "totals_h1,totals_h2,spreads_h1,spreads_h2",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertHalfMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? [], marginPct);
      await prisma.event.update({ where: { id: event.id }, data: { basketballHalfMarketsVersion: BASKETBALL_HALF_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      console.warn(`⚠️  Marchés mi-temps basket — échec pour ${event.homeTeam} vs ${event.awayTeam} : ${err.response?.status ?? "?"} ${JSON.stringify(err.response?.data ?? err.message)}`);
      if (err.response?.status === 404 || err.response?.status === 422) {
        await prisma.event.update({ where: { id: event.id }, data: { basketballHalfMarketsVersion: BASKETBALL_HALF_MARKETS_VERSION } }).catch(() => {});
      }
    }
  }

  if (synced > 0) console.log(`🏀 Marchés mi-temps basket (plus/moins, handicap) : ${synced} match(s) synchronisés`);
}

// ─── Vainqueur du 1er set — tennis ─────────────────────────────────────────────
//
// Clé TheOddsAPI h2h_s1 (catalogue officiel, section "Game Period Markets")
// — demande explicite du 01/11/2026. Non calculable automatiquement (le
// score final ne dit rien du vainqueur du 1er set) : réglage manuel par un
// trader, comme les marchés mi-temps/corners/cartons au football.
const TENNIS_SET_MARKETS_LIMIT = 300;
const TENNIS_SET_MARKETS_VERSION = 1;

export async function syncTennisSetMarkets() {
  if (!API_KEY) return;

  const marginPct = await getSettingFloat(SETTING_KEYS.ODDS_MARGIN_PCT);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 14);

  const events = await prisma.event.findMany({
    where: {
      status: { in: ["UPCOMING", "LIVE"] },
      startTime: { gte: new Date(), lte: cutoff },
      competition: { name: { in: Object.keys(TENNIS_SPORT_KEY_BY_COMPETITION_NAME) } },
      tennisSetMarketsVersion: { lt: TENNIS_SET_MARKETS_VERSION },
    },
    include: { competition: true },
    orderBy: { startTime: "asc" },
    take: TENNIS_SET_MARKETS_LIMIT,
  });

  let synced = 0;
  for (const event of events) {
    const sportKey = TENNIS_SPORT_KEY_BY_COMPETITION_NAME[event.competition.name];
    if (!sportKey || !event.externalId) continue;

    try {
      const res = await axios.get(
        `${ODDS_API_BASE}/sports/${sportKey}/events/${event.externalId}/odds`,
        {
          params: {
            apiKey:     API_KEY,
            regions:    "eu",
            markets:    "h2h_s1",
            oddsFormat: "decimal",
            dateFormat: "iso",
          },
          timeout: 10000,
        },
      );

      const remaining = parseInt(res.headers["x-requests-remaining"] ?? "-1", 10);
      if (remaining >= 0) updateCredits(remaining);

      await upsertTennisSetMarkets(event.id, event.homeTeam, event.awayTeam, res.data?.bookmakers ?? [], marginPct);
      await prisma.event.update({ where: { id: event.id }, data: { tennisSetMarketsVersion: TENNIS_SET_MARKETS_VERSION } });
      synced++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error("ODDS_API_KEY invalide ou quota dépassé");
        break;
      }
      console.warn(`⚠️  Vainqueur 1er set — échec pour ${event.homeTeam} vs ${event.awayTeam} : ${err.response?.status ?? "?"} ${JSON.stringify(err.response?.data ?? err.message)}`);
      if (err.response?.status === 404 || err.response?.status === 422) {
        await prisma.event.update({ where: { id: event.id }, data: { tennisSetMarketsVersion: TENNIS_SET_MARKETS_VERSION } }).catch(() => {});
      }
    }
  }

  if (synced > 0) console.log(`🎾 Vainqueur du 1er set : ${synced} match(s) synchronisés`);
}

async function upsertTennisSetMarkets(eventId: string, homeTeam: string, awayTeam: string, bookmakers: any[], marginPct = 0) {
  const priorityKeys = ["bet365", "unibet", "betway", "onexbet", "pinnacle"];
  const orderedBookmakers = [
    ...priorityKeys.map((k) => bookmakers.find((b: any) => b.key === k)).filter(Boolean),
    ...bookmakers,
  ];

  for (const bookmaker of orderedBookmakers) {
    const apiMarket = (bookmaker.markets ?? []).find((m: any) => m.key === "h2h_s1");
    if (!apiMarket) continue;

    let market = await prisma.market.findFirst({ where: { eventId, type: "FIRST_SET_WINNER" as any } });
    if (!market) {
      market = await prisma.market.create({ data: { eventId, name: "Vainqueur du 1er set", type: "FIRST_SET_WINNER" as any } });
    }

    for (const outcome of apiMarket.outcomes) {
      const label = outcome.name === homeTeam ? "1" : outcome.name === awayTeam ? "2" : outcome.name;
      const value = applyMargin(outcome.price, marginPct);
      const existing = await prisma.odd.findFirst({ where: { marketId: market.id, label } });
      if (existing) {
        await prisma.odd.update({ where: { id: existing.id }, data: { value } });
      } else {
        await prisma.odd.create({ data: { marketId: market.id, label, value } });
      }
    }
    break; // un seul bookmaker pour ce marché à source unique
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

export async function getUpcomingEvents(sportSlug?: string, page = 1, limit = 50, dateFilter?: string, league?: string) {
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
    // "week" au sens large (14 jours, pas 7) — demande explicite du
    // 31/10/2026. La clé reste "week" pour ne pas casser les liens déjà
    // partagés/en cache (?date=week), seul le libellé affiché change.
    dateFrom = new Date(now);
    dateTo   = new Date(now); dateTo.setDate(now.getDate() + 14); dateTo.setHours(23, 59, 59, 999);
  } else if (dateFilter && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
    // Date précise choisie via le sélecteur calendrier du site public —
    // demande explicite du 31/10/2026. Composants extraits manuellement
    // (pas new Date(string) qui interprète une date ISO sans heure comme
    // UTC minuit, décalant le jour affiché selon le fuseau du serveur).
    const [y, m, d] = dateFilter.split("-").map(Number);
    dateFrom = new Date(y, m - 1, d, 0, 0, 0, 0);
    dateTo   = new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  const where = {
    startTime: { gte: dateFrom, ...(dateTo ? { lte: dateTo } : {}) },
    // LIVE exclu : cette plateforme n'a pas de cotes in-play (voir
    // markLiveEvents) — un match déjà commencé n'a plus de prix fiable à
    // afficher, qu'il soit cherché par date "aujourd'hui" (qui couvre toute
    // la journée calendaire, y compris les matchs déjà en cours) ou sans
    // filtre de date du tout.
    status:    "UPCOMING" as const,
    // Recherche par championnat — demande explicite du 31/10/2026 (aucun
    // moyen de filtrer/chercher par compétition jusqu'ici, seulement par
    // sport). Combinée avec le filtre de sport dans le même objet
    // "competition" (deux clés "competition" distinctes s'écraseraient
    // sinon au lieu de se cumuler).
    ...((sportSlug || league) ? {
      competition: {
        ...(sportSlug ? { sport: { slug: sportSlug } } : {}),
        ...(league ? { name: { contains: league, mode: "insensitive" as const } } : {}),
      },
    } : {}),
  };

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: {
        competition: { include: { sport: true } },
        markets: {
          // isPublished : brouillon invisible sur le site/TPE tant qu'un
          // admin ne l'a pas explicitement publié depuis le backoffice
          // (demande explicite du 01/11/2026).
          where: { isActive: true, isSuspended: false, isPublished: true },
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

// Rien dans la synchronisation ne faisait jamais passer un match en LIVE —
// il restait "UPCOMING" (même cotes pré-match vendables) du coup d'envoi
// jusqu'à ce que TheOddsAPI rapporte le score final (parfois bien après la
// fin réelle du match). Un parieur pouvait donc miser à des cotes figées
// avant le match sur une rencontre déjà en cours, voire déjà jouée pour
// l'essentiel — un vrai risque commercial, pas qu'un problème d'affichage.
// Cette plateforme n'a pas de cotes live (pas de flux in-play), donc on ne
// peut pas réévaluer le prix en cours de match : la seule option sûre est
// de suspendre la vente dès le coup d'envoi, jusqu'au règlement final.
// Purement interne (aucun appel API externe), donc peu coûteux à exécuter
// fréquemment.
export async function markLiveEvents() {
  const started = await prisma.event.findMany({
    where: { status: "UPCOMING", startTime: { lte: new Date() } },
    select: { id: true },
  });
  if (started.length === 0) return;

  const ids = started.map((e) => e.id);
  await prisma.$transaction([
    prisma.event.updateMany({ where: { id: { in: ids } }, data: { status: "LIVE" } }),
    prisma.market.updateMany({ where: { eventId: { in: ids } }, data: { isSuspended: true } }),
  ]);
  console.log(`🔴 ${started.length} match(s) passé(s) en direct — cotes suspendues (coup d'envoi dépassé)`);
}

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

/**
 * Déduit et enregistre le résultat de chaque sélection de ticket encore en
 * attente liée à ce match, puis règle les tickets devenus complets.
 * Exportée pour être réutilisée par la saisie manuelle du score final
 * (admin/sports.routes.ts) — les marchés "statistiques" (mi-temps/corners/
 * cartons, voir stats-settlement.ts) ne sont pas reconnus par
 * computeItemResult et sont donc ignorés ici sans risque d'interférence.
 */
export async function settleEventTickets(
  eventId: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number,
): Promise<number> {
  const items = await prisma.ticketItem.findMany({
    where: { result: null, market: { eventId } },
    include: { odd: true, market: true, ticket: true },
  });

  // Pas de filtre sur le statut du ticket ici : même si le ticket est déjà
  // réglé LOST (une autre sélection a perdu avant celle-ci), CHAQUE match
  // doit quand même afficher son vrai résultat une fois terminé — un match
  // encore en cours reste non renseigné, un match gagné affiche "Gagné"
  // normalement, etc. Seul le réglage du TICKET (plus bas) est conditionné
  // à PENDING, pas l'enregistrement du résultat de chaque sélection.
  const touchedTicketIds = new Set<string>();
  for (const item of items) {
    const result = computeItemResult(item.market.type, item.odd.label, homeTeam, awayTeam, homeScore, awayScore);
    if (!result) continue; // type de marché ou libellé non calculable automatiquement — laissé pour saisie manuelle
    await prisma.ticketItem.update({ where: { id: item.id }, data: { result } });
    touchedTicketIds.add(item.ticketId);
  }

  let settledCount = 0;
  for (const ticketId of touchedTicketIds) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { items: true } });
    // Une sélection déjà PERDUE clôture le ticket sans attendre les autres
    // (voir settleTicket, tpe.service.ts) — pas besoin que tout soit résolu.
    const ready = ticket && (ticket.items.every((i) => i.result !== null) || ticket.items.some((i) => i.result === "LOST"));
    if (ticket && ticket.status === "PENDING" && ready) {
      await settleTicket(ticketId);
      settledCount++;
    }
  }
  return settledCount;
}

/** Calcule le résultat d'une sélection à partir du score final — null si le marché/libellé n'est pas reconnu (saisie manuelle requise). */
/**
 * Exportée pour être réutilisée par api-football.service.ts — rattrapage
 * des marchés classiques (score final) pour un match que TheOddsAPI n'a
 * jamais marqué "completed" dans sa fenêtre de 3 jours (daysFrom, plafond
 * de l'API — voir syncScoresAndSettle), via la 2nde source de score
 * indépendante déjà en place pour les marchés statistiques.
 */
export function computeItemResult(
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
    // ─── Marchés additionnels calculables à partir du seul score final ───
    case "ODD_EVEN_TOTAL": {
      if (label !== "Pair" && label !== "Impair") return null;
      const even = (homeScore + awayScore) % 2 === 0;
      return (label === "Pair") === even ? "WON" : "LOST";
    }
    case "CLEAN_SHEET": {
      const m = label.match(/^(.+) (Oui|Non)$/);
      if (!m) return null;
      const [, team, answer] = m;
      const cleanSheet = team === homeTeam ? awayScore === 0 : team === awayTeam ? homeScore === 0 : null;
      if (cleanSheet === null) return null;
      return (answer === "Oui") === cleanSheet ? "WON" : "LOST";
    }
    case "WIN_TO_NIL": {
      const m = label.match(/^(.+) (Oui|Non)$/);
      if (!m) return null;
      const [, team, answer] = m;
      const winToNil = team === homeTeam ? homeScore > awayScore && awayScore === 0
        : team === awayTeam ? awayScore > homeScore && homeScore === 0
        : null;
      if (winToNil === null) return null;
      return (answer === "Oui") === winToNil ? "WON" : "LOST";
    }
    case "WINNING_MARGIN": {
      const diff = homeScore - awayScore;
      const bucket = Math.abs(diff) >= 3 ? "3+" : String(Math.abs(diff));
      const computed = diff === 0 ? "X" : `${diff > 0 ? "1" : "2"} (${bucket})`;
      return label === computed ? "WON" : "LOST";
    }
    case "TEAM_GOALS": {
      const m = label.match(/^(.+) (0|1|2|3\+)$/);
      if (!m) return null;
      const [, team, bucketLabel] = m;
      const score = team === homeTeam ? homeScore : team === awayTeam ? awayScore : null;
      if (score === null) return null;
      const bucket = score >= 3 ? "3+" : String(score);
      return bucketLabel === bucket ? "WON" : "LOST";
    }
    // ─── Marchés combinés "Niveau 2" calculables à partir du seul score
    // final — voir deriveLevel2Markets (goal-model.ts). Combiné = gagné
    // seulement si les deux jambes le sont, comme tout pari combiné
    // classique (pas de VOID : un total de 2.5 pile est impossible avec des
    // scores entiers).
    case "DOUBLE_CHANCE_BTTS": {
      const m = label.match(/^(1X|12|X2) & (Oui|Non)$/);
      if (!m) return null;
      const [, dc, btts] = m;
      const dcWon = dc === "1X" ? homeScore >= awayScore : dc === "X2" ? awayScore >= homeScore : homeScore !== awayScore;
      const bttsWon = (btts === "Oui") === (homeScore > 0 && awayScore > 0);
      return dcWon && bttsWon ? "WON" : "LOST";
    }
    case "RESULT_BTTS": {
      const m = label.match(/^(1|X|2) & (Oui|Non)$/);
      if (!m) return null;
      const [, res, btts] = m;
      const resWon = res === "1" ? homeScore > awayScore : res === "2" ? awayScore > homeScore : homeScore === awayScore;
      const bttsWon = (btts === "Oui") === (homeScore > 0 && awayScore > 0);
      return resWon && bttsWon ? "WON" : "LOST";
    }
    case "RESULT_TOTAL": {
      const m = label.match(/^(1|X|2) & (Plus|Moins) 2\.5$/);
      if (!m) return null;
      const [, res, dir] = m;
      const resWon = res === "1" ? homeScore > awayScore : res === "2" ? awayScore > homeScore : homeScore === awayScore;
      const totalWon = (dir === "Plus") === (homeScore + awayScore > 2.5);
      return resWon && totalWon ? "WON" : "LOST";
    }
    case "DOUBLE_CHANCE_TOTAL": {
      const m = label.match(/^(1X|12|X2) & (Plus|Moins) 2\.5$/);
      if (!m) return null;
      const [, dc, dir] = m;
      const dcWon = dc === "1X" ? homeScore >= awayScore : dc === "X2" ? awayScore >= homeScore : homeScore !== awayScore;
      const totalWon = (dir === "Plus") === (homeScore + awayScore > 2.5);
      return dcWon && totalWon ? "WON" : "LOST";
    }
    default:
      return null; // FIRST_GOAL_SCORER, HALF_TIME_RESULT : non proposés à la vente, pas de calcul
  }
}
