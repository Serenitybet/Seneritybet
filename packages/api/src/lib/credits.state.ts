// ─── État partagé des crédits TheOddsAPI ─────────────────────────────────────
// Singleton léger — importé par odds.service, odds-sync.worker et les routes admin

interface CreditsState {
  remaining: number | null;
  used:      number | null;
  paused:    boolean;
  lastSync:  Date | null;
}

const state: CreditsState = {
  remaining: null,
  used:      null,
  paused:    false,
  lastSync:  null,
};

const LOW_CREDIT_LIMIT = 500;

export function updateCredits(remaining: number, used?: number) {
  state.remaining = remaining;
  if (used !== undefined) state.used = used;
  state.lastSync = new Date();

  if (remaining < LOW_CREDIT_LIMIT && !state.paused) {
    state.paused = true;
    console.warn(`⚠️  TheOddsAPI : ${remaining} crédits restants — sync mise en pause !`);
  } else if (remaining >= LOW_CREDIT_LIMIT && state.paused) {
    state.paused = false;
    console.log(`✅ TheOddsAPI : crédits OK (${remaining}) — sync reprise`);
  }
}

export function getCreditsStatus() {
  return { ...state };
}

export function isSyncPaused() {
  return state.paused;
}
