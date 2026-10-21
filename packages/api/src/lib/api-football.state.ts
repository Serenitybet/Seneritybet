// ─── État partagé du quota API-Football ──────────────────────────────────────
// Contrairement à TheOddsAPI, API-Football ne renvoie pas de quota restant
// dans ses en-têtes de réponse à chaque appel — on compte donc nous-mêmes les
// requêtes envoyées, remis à zéro chaque jour à minuit UTC (reset observé du
// forfait gratuit). Une marge de sécurité est gardée en réserve pour ne
// jamais épuiser totalement le quota (tests manuels, autres usages de la clé).
const DAILY_SAFETY_MARGIN = 15;

interface ApiFootballState {
  usedToday: number;
  resetAt: number; // epoch ms
}

const state: ApiFootballState = {
  usedToday: 0,
  resetAt: nextMidnightUTC(),
};

function nextMidnightUTC(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function rolloverIfNeeded() {
  if (Date.now() >= state.resetAt) {
    state.usedToday = 0;
    state.resetAt = nextMidnightUTC();
  }
}

export function canMakeApiFootballRequest(dailyLimit: number): boolean {
  rolloverIfNeeded();
  return state.usedToday < Math.max(dailyLimit - DAILY_SAFETY_MARGIN, 0);
}

export function recordApiFootballRequest() {
  rolloverIfNeeded();
  state.usedToday++;
}

export function getApiFootballUsage() {
  rolloverIfNeeded();
  return { ...state };
}
