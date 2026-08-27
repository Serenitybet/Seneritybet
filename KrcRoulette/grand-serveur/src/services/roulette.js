const ALL_NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0..36

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function getColor(number) {
  if (number === 0) return 'vert';
  return RED_NUMBERS.has(number) ? 'rouge' : 'noir';
}

function getPayoutMultiplier(betType) {
  switch (betType) {
    case 'NUMBER':
      return 36;
    case 'COLOR':
      return 2;
    case 'PARITY':
      return 2;
    case 'DOZEN':
      return 3;
    default:
      throw new Error(`Type de mise inconnu: ${betType}`);
  }
}

// bet: { betType, betValue, stake, payoutMultiplier }
function betWins(bet, winningNumber) {
  switch (bet.betType) {
    case 'NUMBER':
      return Number(bet.betValue) === winningNumber;
    case 'COLOR':
      return winningNumber !== 0 && bet.betValue === getColor(winningNumber);
    case 'PARITY':
      if (winningNumber === 0) return false;
      return bet.betValue === (winningNumber % 2 === 0 ? 'pair' : 'impair');
    case 'DOZEN': {
      if (winningNumber === 0) return false;
      const ranges = { '1-12': [1, 12], '13-24': [13, 24], '25-36': [25, 36] };
      const range = ranges[bet.betValue];
      return range ? winningNumber >= range[0] && winningNumber <= range[1] : false;
    }
    default:
      return false;
  }
}

function payoutForNumber(bets, winningNumber) {
  return bets.reduce((sum, bet) => (betWins(bet, winningNumber) ? sum + bet.stake * bet.payoutMultiplier : sum), 0);
}

module.exports = { ALL_NUMBERS, RED_NUMBERS, getColor, getPayoutMultiplier, betWins, payoutForNumber };
