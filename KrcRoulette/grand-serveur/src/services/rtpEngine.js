const { ALL_NUMBERS, getColor, payoutForNumber } = require('./roulette');

// Force la fonction de décroissance du poids budgétaire (plus haut = plus agressif quand ça coûte cher)
const WEIGHT_DECAY_K = 3;
// Intensité maximale de resserrement — jamais 100%, pour rester "imprévisible"
const MAX_INTENSITY = 0.92;

/**
 * Décide du numéro gagnant d'un round de roulette en tenant compte du RTP mensuel cible.
 *
 * @param {Object} params
 * @param {Array<{betType:string, betValue:string, stake:number, payoutMultiplier:number}>} params.openBets
 *   Toutes les mises ouvertes du round en cours.
 * @param {{ totalWagered: number, totalPaid: number }} params.monthlyStats
 *   Cumuls du mois en cours AVANT ce round (hors mises de ce round).
 * @param {{ targetRtp: number, bonusRtp: number }} params.rtpConfig  RTP en pourcentage (ex: 85).
 * @param {boolean} [params.isBonusActive]
 * @param {() => number} [params.random]  Générateur [0,1) injectable (tests).
 * @returns {number} le numéro gagnant (0-36)
 */
function decideWinningNumber({ openBets, monthlyStats, rtpConfig, isBonusActive = false, random = Math.random }) {
  const targetRtp = (isBonusActive ? rtpConfig.bonusRtp : rtpConfig.targetRtp) / 100;

  const currentRoundStake = openBets.reduce((sum, b) => sum + b.stake, 0);
  const projectedTotalWagered = monthlyStats.totalWagered + currentRoundStake;
  const targetPayoutCeiling = projectedTotalWagered * targetRtp;
  const remainingBudget = targetPayoutCeiling - monthlyStats.totalPaid;

  // Aucune mise: le résultat n'a aucun impact financier, tirage purement aléatoire.
  if (currentRoundStake === 0) {
    return ALL_NUMBERS[Math.floor(random() * ALL_NUMBERS.length)];
  }

  // RTP courant du mois observé jusqu'ici (avant ce round) — pilote l'agressivité.
  const currentRtp = monthlyStats.totalWagered > 0 ? monthlyStats.totalPaid / monthlyStats.totalWagered : targetRtp;
  const overshoot = (currentRtp - targetRtp) / targetRtp; // >0 si on paie trop par rapport à la cible
  const intensity = Math.min(Math.max(overshoot, 0), 1) * MAX_INTENSITY;

  const payouts = ALL_NUMBERS.map((n) => payoutForNumber(openBets, n));

  const budgetWeights = payouts.map((payout) => {
    if (remainingBudget <= 0) {
      // Budget déjà dépassé: on favorise fortement les numéros à payout nul, sans jamais les rendre impossibles.
      return payout === 0 ? 1 : Math.exp(-WEIGHT_DECAY_K * 4);
    }
    return Math.exp((-WEIGHT_DECAY_K * payout) / remainingBudget);
  });

  const uniformWeight = 1 / ALL_NUMBERS.length;
  const blended = budgetWeights.map((w) => Math.pow(w, intensity) * Math.pow(uniformWeight, 1 - intensity));

  const total = blended.reduce((a, b) => a + b, 0);
  const probabilities = blended.map((w) => w / total);

  let r = random();
  for (let i = 0; i < ALL_NUMBERS.length; i++) {
    r -= probabilities[i];
    if (r <= 0) return ALL_NUMBERS[i];
  }
  return ALL_NUMBERS[ALL_NUMBERS.length - 1];
}

function settleTicketBets(bets, winningNumber) {
  const { betWins } = require('./roulette');
  let totalPayout = 0;
  const settled = bets.map((bet) => {
    const isWinner = betWins(bet, winningNumber);
    const payoutAmount = isWinner ? bet.stake * bet.payoutMultiplier : 0;
    totalPayout += payoutAmount;
    return { ...bet, isWinner, payoutAmount };
  });
  return { settled, totalPayout, winningColor: getColor(winningNumber) };
}

module.exports = { decideWinningNumber, settleTicketBets };
