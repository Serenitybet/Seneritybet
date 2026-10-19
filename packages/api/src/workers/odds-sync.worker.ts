import { syncOddsFromAPI, syncExtraMarkets } from "../services/odds.service";
import { isSyncPaused, getCreditsStatus } from "../lib/credits.state";

// ─── Budget crédits TheOddsAPI ────────────────────────────────────────────────
// Plan 100K/mois → ~3 300 crédits/jour disponibles
// 17 championnats × 3 syncs/heure × 24h × 30j = ~36 700 crédits/mois (cotes principales)
// + marchés additionnels (BTTS, double chance — tous les championnats, matchs des
//   48h à venir, plafonné à 60 matchs/exécution, 1 seule fois par match) toutes
//   les 2h : coût estimé modeste vu le volume hebdo, mais À SURVEILLER sur le
//   dashboard TheOddsAPI les premières semaines — augmenter le plan si besoin.
// Marge de sécurité confortable sur le plan 100K.

const ODDS_INTERVAL_MS       = 20 * 60 * 1000;      // 20 minutes — cotes principales
const EXTRA_MARKETS_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 heures — marchés additionnels

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

export function startOddsSyncWorker() {
  const credits = getCreditsStatus();
  console.log(`📡 Worker cotes démarré — sync toutes les 20 min, marchés additionnels toutes les 2h`);
  if (credits.remaining !== null) {
    console.log(`   Crédits restants : ${credits.remaining}`);
  }

  // Sync initiale après 5 secondes (laisser le serveur démarrer)
  setTimeout(() => runSync(), 5_000);
  setTimeout(() => runExtraMarketsSync(), 30_000);

  // Sync régulière
  setInterval(() => runSync(), ODDS_INTERVAL_MS);
  setInterval(() => runExtraMarketsSync(), EXTRA_MARKETS_INTERVAL_MS);
}
