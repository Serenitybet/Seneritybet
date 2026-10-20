import { syncOddsFromAPI, syncExtraMarkets, syncPropMarkets, syncHalfMarkets, syncScoresAndSettle } from "../services/odds.service";
import { isSyncPaused, getCreditsStatus } from "../lib/credits.state";

// ─── Budget crédits TheOddsAPI ────────────────────────────────────────────────
// Plan 100K/mois → ~3 300 crédits/jour disponibles
// 17 championnats × 3 syncs/heure × 24h × 30j = ~36 700 crédits/mois (cotes principales)
// + marchés additionnels (BTTS, double chance, score exact, remboursé si nul,
//   plus/moins alternatif, handicap alternatif, totaux par équipe — 7
//   marchés × 1 région = 7 crédits/match, tous les championnats, matchs des
//   7 prochains jours, plafonné à 600 matchs/exécution, 1 seule fois par
//   match tant que EXTRA_MARKETS_VERSION ne change pas) toutes les 30 min.
//   Le volume total de matchs ne change pas avec la fréquence ou le plafond
//   — ça réduit juste le temps pour couvrir tout le calendrier.
// + marchés stats (1ère/2nde mi-temps, corners, cartons — football
//   uniquement, 6 marchés × 1 région = 6 crédits/match, plafonné à 600
//   matchs/exécution, 1 seule fois par match tant que PROP_MARKETS_VERSION
//   ne change pas) toutes les 45 min. Lot séparé des marchés additionnels
//   ci-dessus (voir odds.service.ts) pour qu'une clé de marché invalide
//   n'affecte que ce lot.
// + marchés mi-temps (plus/moins, handicap, double chance déclinés par
//   mi-temps — football uniquement, 6 marchés × 1 région = 6 crédits/match,
//   plafonné à 600 matchs/exécution, 1 seule fois par match tant que
//   HALF_MARKETS_VERSION ne change pas) toutes les 50 min. Lot séparé de
//   syncPropMarkets pour la même raison (voir odds.service.ts).
// + résultats finaux (1 appel /scores par championnat, 17 championnats ×
//   4 cycles/heure × 24h × 30j = ~48 900 crédits/mois) toutes les 15 min,
//   pour régler automatiquement les tickets dès que le match est terminé.
//   À SURVEILLER sur le dashboard TheOddsAPI les
//   premières semaines — augmenter le plan si besoin.
// Passage prévu au palier TheOddsAPI 5M crédits/mois pour absorber ce lot
// supplémentaire sans pression sur le budget.

const ODDS_INTERVAL_MS          = 20 * 60 * 1000; // 20 minutes — cotes principales
const EXTRA_MARKETS_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes — marchés additionnels
const PROP_MARKETS_INTERVAL_MS  = 45 * 60 * 1000; // 45 minutes — marchés stats (mi-temps, corners, cartons)
const HALF_MARKETS_INTERVAL_MS  = 50 * 60 * 1000; // 50 minutes — marchés mi-temps (plus/moins, handicap, double chance)
const SCORES_INTERVAL_MS        = 15 * 60 * 1000; // 15 minutes — résultats finaux + règlement auto

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

export function startOddsSyncWorker() {
  const credits = getCreditsStatus();
  console.log(`📡 Worker cotes démarré — sync toutes les 20 min, marchés additionnels toutes les 30 min, marchés stats toutes les 45 min, marchés mi-temps toutes les 50 min, résultats toutes les 15 min`);
  if (credits.remaining !== null) {
    console.log(`   Crédits restants : ${credits.remaining}`);
  }

  // Sync initiale après 5 secondes (laisser le serveur démarrer)
  setTimeout(() => runSync(), 5_000);
  setTimeout(() => runExtraMarketsSync(), 30_000);
  setTimeout(() => runPropMarketsSync(), 40_000);
  setTimeout(() => runHalfMarketsSync(), 50_000);
  setTimeout(() => runScoresSync(), 55_000);

  // Sync régulière
  setInterval(() => runSync(), ODDS_INTERVAL_MS);
  setInterval(() => runExtraMarketsSync(), EXTRA_MARKETS_INTERVAL_MS);
  setInterval(() => runPropMarketsSync(), PROP_MARKETS_INTERVAL_MS);
  setInterval(() => runHalfMarketsSync(), HALF_MARKETS_INTERVAL_MS);
  setInterval(() => runScoresSync(), SCORES_INTERVAL_MS);
}
