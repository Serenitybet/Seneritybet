import { syncAllSportradar, syncLiveOnly } from "../services/sportradar.service";

export function startOddsSyncWorker() {
  const FULL_INTERVAL = 5 * 60 * 1000;  // Sync complète toutes les 5 min
  const LIVE_INTERVAL = 60 * 1000;       // Sync live toutes les 60s

  // Sync complète au démarrage
  syncAllSportradar().catch(err => console.error("Erreur sync initiale:", err));

  // Sync complète répétée toutes les 5 minutes
  setInterval(() => {
    syncAllSportradar().catch(err => console.error("Erreur sync complète:", err));
  }, FULL_INTERVAL);

  // Sync live rapide toutes les 60 secondes
  setInterval(() => {
    syncLiveOnly().catch(err => console.error("Erreur sync live:", err));
  }, LIVE_INTERVAL);
}
