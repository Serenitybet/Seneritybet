import { resetDailyCreditsIfDue } from "../services/tpe.service";

// Toutes les 5 min (même cadence que les vérifications internes du worker de
// cotes) — resetDailyCreditsIfDue() ne fait rien si rien n'est dû, donc un
// intervalle court ne coûte rien et rattrape vite toute réinitialisation
// manquée après un redémarrage/une panne ayant couvert minuit.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function runCreditReset() {
  try {
    const { resetCount } = await resetDailyCreditsIfDue();
    if (resetCount > 0) {
      console.log(`💳 Palier journalier réinitialisé pour ${resetCount} TPE`);
    }
  } catch (err) {
    console.error("❌ Erreur réinitialisation journalière du crédit TPE :", err);
  }
}

export function startCreditResetWorker() {
  console.log("💳 Worker palier journalier TPE démarré — vérification toutes les 5 min");
  setTimeout(() => runCreditReset(), 15_000);
  setInterval(() => runCreditReset(), CHECK_INTERVAL_MS);
}
