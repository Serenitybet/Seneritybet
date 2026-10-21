import { syncOddsFromAPI, syncExtraMarkets, syncPropMarkets, syncHalfMarkets, syncScoresAndSettle } from "../services/odds.service";
import { isSyncPaused, getCreditsStatus } from "../lib/credits.state";
import { syncApiFootballSettlement } from "../services/api-football.service";

// ─── Budget crédits TheOddsAPI ────────────────────────────────────────────────
// Plan 5M/mois (passage depuis 100K le 20/10/2026 pour supporter ce rythme).
// Les cotes principales et les résultats se répètent à CHAQUE cycle pour
// TOUS les matchs — ce sont elles qui scalent avec la fréquence :
//   17 championnats × 12 syncs/heure (5 min) × 24h × 30j = ~147 000
//   crédits/mois (cotes principales), autant pour les résultats (5 min
//   aussi) = ~147 000 crédits/mois. Total ~294 000/mois, moins de 6% du
//   palier 5M — grosse marge, y compris pour une fréquence encore plus
//   élevée si besoin.
// + marchés additionnels (BTTS, double chance, score exact, remboursé si nul,
//   plus/moins alternatif, handicap alternatif, totaux par équipe — 7
//   marchés × 1 région = 7 crédits/match, tous les championnats, matchs des
//   7 prochains jours, plafonné à 600 matchs/exécution, 1 seule fois par
//   match tant que EXTRA_MARKETS_VERSION ne change pas) toutes les 15 min.
// + marchés stats (1ère/2nde mi-temps, corners, cartons — football
//   uniquement, 6 marchés × 1 région = 6 crédits/match, plafonné à 600
//   matchs/exécution, 1 seule fois par match tant que PROP_MARKETS_VERSION
//   ne change pas) toutes les 17 min. Lot séparé des marchés additionnels
//   ci-dessus (voir odds.service.ts) pour qu'une clé de marché invalide
//   n'affecte que ce lot.
// + marchés mi-temps (plus/moins, handicap, double chance déclinés par
//   mi-temps — football uniquement, 6 marchés × 1 région = 6 crédits/match,
//   plafonné à 600 matchs/exécution, 1 seule fois par match tant que
//   HALF_MARKETS_VERSION ne change pas) toutes les 19 min. Lot séparé de
//   syncPropMarkets pour la même raison (voir odds.service.ts).
//   Ces trois lots ne scalent PAS avec la fréquence (1 seule fois par
//   match, jamais répété tant que la version ne change pas) : les
//   descendre à 15-19 min accélère juste la couverture des nouveaux
//   matchs qui arrivent au calendrier, sans alourdir le coût mensuel —
//   intervalles décalés entre eux pour ne jamais tourner pile en même
//   temps.
// À SURVEILLER sur le dashboard TheOddsAPI les premières semaines.

const ODDS_INTERVAL_MS          = 5  * 60 * 1000; // 5 minutes  — cotes principales
const EXTRA_MARKETS_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes — marchés additionnels
const PROP_MARKETS_INTERVAL_MS  = 17 * 60 * 1000; // 17 minutes — marchés stats (corners, cartons, vainqueur mi-temps)
const HALF_MARKETS_INTERVAL_MS  = 19 * 60 * 1000; // 19 minutes — marchés mi-temps (plus/moins, handicap, double chance)
const SCORES_INTERVAL_MS        = 5  * 60 * 1000; // 5 minutes  — résultats finaux + règlement auto

// Règlement automatique via API-Football (mi-temps, corners, cartons — voir
// api-football.service.ts), indépendant de TheOddsAPI (clé/quota séparés,
// jamais mis en pause par isSyncPaused qui ne concerne que les crédits
// TheOddsAPI). Palier Pro (7 500 req/jour, depuis le 21/10/2026) : intervalle
// réduit pour un règlement plus rapide, le service reste protégé par son
// propre quota + plafond de matchs par cycle en interne.
const API_FOOTBALL_INTERVAL_MS  = 10 * 60 * 1000; // 10 minutes

async function runSync() {
  if (isSyncPaused()) {
    console.warn("⏸  Sync ignorée — crédits TheOddsAPI insuffisants (< 500)");
    return;
  }
  try {
    await syncOddsFromAPI();
  } catch (err) {
    console.error("❌ Erreur sync TheOddsAPI:", err);
  }
}

async function runExtraMarketsSync() {
  if (isSyncPaused()) return;
  try {
    await syncExtraMarkets();
  } catch (err) {
    console.error("❌ Erreur sync marchés additionnels:", err);
  }
}

async function runPropMarketsSync() {
  if (isSyncPaused()) return;
  try {
    await syncPropMarkets();
  } catch (err) {
    console.error("❌ Erreur sync marchés stats:", err);
  }
}

async function runHalfMarketsSync() {
  if (isSyncPaused()) return;
  try {
    await syncHalfMarkets();
  } catch (err) {
    console.error("❌ Erreur sync marchés mi-temps:", err);
  }
}

async function runScoresSync() {
  if (isSyncPaused()) return;
  try {
    await syncScoresAndSettle();
  } catch (err) {
    console.error("❌ Erreur sync résultats:", err);
  }
}

async function runApiFootballSettlement() {
  try {
    await syncApiFootballSettlement();
  } catch (err) {
    console.error("❌ Erreur règlement API-Football:", err);
  }
}

export function startOddsSyncWorker() {
  const credits = getCreditsStatus();
  console.log(`📡 Worker cotes démarré — sync toutes les 5 min, marchés additionnels toutes les 15 min, marchés stats toutes les 17 min, marchés mi-temps toutes les 19 min, résultats toutes les 5 min`);
  if (credits.remaining !== null) {
    console.log(`   Crédits restants : ${credits.remaining}`);
  }

  // Sync initiale après 5 secondes (laisser le serveur démarrer)
  setTimeout(() => runSync(), 5_000);
  setTimeout(() => runExtraMarketsSync(), 30_000);
  setTimeout(() => runPropMarketsSync(), 40_000);
  setTimeout(() => runHalfMarketsSync(), 50_000);
  setTimeout(() => runScoresSync(), 55_000);
  setTimeout(() => runApiFootballSettlement(), 90_000);

  // Sync régulière
  setInterval(() => runSync(), ODDS_INTERVAL_MS);
  setInterval(() => runExtraMarketsSync(), EXTRA_MARKETS_INTERVAL_MS);
  setInterval(() => runPropMarketsSync(), PROP_MARKETS_INTERVAL_MS);
  setInterval(() => runHalfMarketsSync(), HALF_MARKETS_INTERVAL_MS);
  setInterval(() => runScoresSync(), SCORES_INTERVAL_MS);
  setInterval(() => runApiFootballSettlement(), API_FOOTBALL_INTERVAL_MS);
}
