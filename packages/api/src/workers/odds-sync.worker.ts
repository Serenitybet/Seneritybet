import { syncOddsFromAPI } from "../services/odds.service";
import { isSyncPaused, getCreditsStatus } from "../lib/credits.state";

// ─── Budget crédits TheOddsAPI ────────────────────────────────────────────────
// Plan 100K/mois → ~3 300 crédits/jour disponibles
// 26 sports × 3 syncs/heure × 24h × 30j = ~56 000 crédits/mois ✅
// Marge de sécurité : ~44 000 crédits pour les pics de trafic

const ODDS_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

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

export function startOddsSyncWorker() {
  const credits = getCreditsStatus();
  console.log(`📡 Worker cotes démarré — sync toutes les 20 min (~56K crédits/mois)`);
  if (credits.remaining !== null) {
    console.log(`   Crédits restants : ${credits.remaining}`);
  }

  // Sync initiale après 5 secondes (laisser le serveur démarrer)
  setTimeout(() => runSync(), 5_000);

  // Sync régulière toutes les 20 minutes
  setInterval(() => runSync(), ODDS_INTERVAL_MS);
}
