import { syncOddsFromAPI } from "../services/odds.service";
import { syncLiveOnly } from "../services/sportradar.service";

export function startOddsSyncWorker() {
  // TheOddsAPI : sync matchs à venir toutes les 10 min
  const ODDS_INTERVAL = 10 * 60 * 1000;
  // Sportradar : sync live toutes les 60s
  const LIVE_INTERVAL = 60 * 1000;

  // Sync initiale au démarrage
  syncOddsFromAPI().catch(err => console.error("Erreur sync initiale:", err));

  // Sync matchs à venir (TheOddsAPI) toutes les 10 minutes
  setInterval(() => {
    syncOddsFromAPI().catch(err => console.error("Erreur sync TheOddsAPI:", err));
  }, ODDS_INTERVAL);

  // Sync matchs live (Sportradar) toutes les 60 secondes
  setInterval(() => {
    syncLiveOnly().catch(err => console.error("Erreur sync live:", err));
  }, LIVE_INTERVAL);
}
