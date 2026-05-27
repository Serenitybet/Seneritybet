import { syncOddsFromAPI } from "../services/odds.service";

export function startOddsSyncWorker() {
  const interval = parseInt(process.env.ODDS_SYNC_INTERVAL_MS ?? "30000", 10);

  const run = async () => {
    try {
      await syncOddsFromAPI();
    } catch (err) {
      console.error("Erreur sync cotes:", err);
    }
  };

  // Première sync immédiate au démarrage
  run();
  setInterval(run, interval);
}
