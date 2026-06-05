import { syncAllSportradar } from "../services/sportradar.service";

export function startOddsSyncWorker() {
  // Sync toutes les 5 minutes pour les événements
  const EVENTS_INTERVAL = parseInt(process.env.ODDS_SYNC_INTERVAL_MS ?? "300000", 10);
  // Sync live toutes les 60 secondes
  const LIVE_INTERVAL   = 60_000;

  const run = async () => {
    try {
      await syncAllSportradar();
    } catch (err) {
      console.error("Erreur sync Sportradar:", err);
    }
  };

  // Première sync au démarrage
  run();
  setInterval(run, EVENTS_INTERVAL);
}
