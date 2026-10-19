import { syncOddsFromAPI, syncExtraMarkets, syncScoresAndSettle } from "../services/odds.service";
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
// + résultats finaux (1 appel /scores par championnat, 17 championnats ×
//   4 cycles/heure × 24h × 30j = ~48 900 crédits/mois) toutes les 15 min,
//   pour régler automatiquement les tickets dès que le match est terminé.
//   À SURVEILLER sur le dashboard TheOddsAPI les
//   premières semaines — augmenter le plan si besoin.
// Marge de sécurité confortable sur le plan 100K.

const ODDS_INTERVAL_MS          = 20 * 60 * 1000; // 20 minutes — cotes principales
const EXTRA_MARKETS_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes — marchés additionnels
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
  console.log(`📡 Worker cotes démarré — sync toutes les 20 min, marchés additionnels toutes les 30 min, résultats toutes les 15 min`);
  if (credits.remaining !== null) {
    console.log(`   Crédits restants : ${credits.remaining}`);
  }

  // Sync initiale après 5 secondes (laisser le serveur démarrer)
  setTimeout(() => runSync(), 5_000);
  setTimeout(() => runExtraMarketsSync(), 30_000);
  setTimeout(() => runScoresSync(), 45_000);

  // Sync régulière
  setInterval(() => runSync(), ODDS_INTERVAL_MS);
  setInterval(() => runExtraMarketsSync(), EXTRA_MARKETS_INTERVAL_MS);
  setInterval(() => runScoresSync(), SCORES_INTERVAL_MS);
}
