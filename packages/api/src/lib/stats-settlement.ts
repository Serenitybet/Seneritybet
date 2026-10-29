// ─── Calcul du résultat des marchés "statistiques" ───────────────────────────
// Marchés que TheOddsAPI (score final uniquement, via /scores) ne peut pas
// régler seul : mi-temps (nécessite le score à la pause), corners et
// cartons. Utilisé par deux chemins qui alimentent les mêmes données :
// - api-football.service.ts (automatique, données venant d'API-Football)
// - admin/sports.routes.ts (saisie manuelle par un trader)
// Même logique que computeItemResult (odds.service.ts) mais appliquée à des
// paires domicile/extérieur différentes selon le marché (score mi-temps,
// score 2nde mi-temps dérivé, corners, cartons) au lieu du score final du
// match. Dupliquée volontairement plutôt que fusionnée dans
// computeItemResult : odds.service.ts règle déjà de l'argent réel en
// production, aucune prise de risque sur ce code éprouvé pour cette
// extension.

export const STATS_MARKET_TYPES = [
  "FIRST_HALF_WINNER", "SECOND_HALF_WINNER",
  "FIRST_HALF_TOTALS", "FIRST_HALF_HANDICAP", "FIRST_HALF_DOUBLE_CHANCE",
  "SECOND_HALF_TOTALS", "SECOND_HALF_HANDICAP", "SECOND_HALF_DOUBLE_CHANCE",
  "CORNERS_TOTAL", "CORNERS_HANDICAP", "CARDS_TOTAL", "CARDS_HANDICAP",
  "HALF_TIME_CORRECT_SCORE", "HALF_TIME_FULL_TIME", "BOTH_HALVES_SCORE",
  "SHOTS_ON_TARGET_TOTAL", "FOULS_TOTAL",
] as const;

export function totalsResult(label: string, total: number): "WON" | "LOST" | "VOID" | null {
  const m = label.match(/^(Plus|Moins)\s+([\d.]+)/); // tolère un éventuel suffixe (" corners"/" cartons")
  if (!m) return null;
  const line = parseFloat(m[2]);
  if (total === line) return "VOID"; // ligne entière atteinte pile — remboursé
  return (m[1] === "Plus") === (total > line) ? "WON" : "LOST";
}

export function handicapResult(label: string, homeVal: number, awayVal: number): "WON" | "LOST" | "VOID" | null {
  const m = label.match(/^([12])\s*\(([+-]?[\d.]+)\)$/);
  if (!m) return null;
  const side = m[1];
  const point = parseFloat(m[2]);
  const ownVal = side === "1" ? homeVal : awayVal;
  const oppVal = side === "1" ? awayVal : homeVal;
  const adjusted = ownVal + point;
  if (adjusted === oppVal) return "VOID"; // push — remboursé
  return adjusted > oppVal ? "WON" : "LOST";
}

export function doubleChanceResult(label: string, homeVal: number, awayVal: number): "WON" | "LOST" | null {
  const homeOrDraw = homeVal >= awayVal;
  const awayOrDraw = awayVal >= homeVal;
  const notDraw    = homeVal !== awayVal;
  const won = label === "1X" ? homeOrDraw : label === "X2" ? awayOrDraw : label === "12" ? notDraw : null;
  return won === null ? null : won ? "WON" : "LOST";
}

export function winnerResult(label: string, homeVal: number, awayVal: number): "WON" | "LOST" {
  const winner = homeVal > awayVal ? "1" : awayVal > homeVal ? "2" : "X";
  return label === winner ? "WON" : "LOST";
}

/** "1"/"X"/"2" selon le signe de l'écart — utilisé pour le double résultat mi-temps/fin de match. */
function sideResult(home: number, away: number): "1" | "X" | "2" {
  return home > away ? "1" : home < away ? "2" : "X";
}

export function computeStatsItemResult(
  marketType: string, label: string,
  homeTeam: string, awayTeam: string,
  htHome: number, htAway: number, ftHome: number, ftAway: number,
  corners: { home: number; away: number } | null,
  cards:   { home: number; away: number } | null,
  shots:   { home: number; away: number } | null = null,
  fouls:   { home: number; away: number } | null = null,
): "WON" | "LOST" | "VOID" | null {
  const shHome = ftHome - htHome;
  const shAway = ftAway - htAway;
  switch (marketType) {
    case "FIRST_HALF_WINNER":         return winnerResult(label, htHome, htAway);
    case "SECOND_HALF_WINNER":        return winnerResult(label, shHome, shAway);
    case "FIRST_HALF_DOUBLE_CHANCE":  return doubleChanceResult(label, htHome, htAway);
    case "SECOND_HALF_DOUBLE_CHANCE": return doubleChanceResult(label, shHome, shAway);
    case "FIRST_HALF_TOTALS":         return totalsResult(label, htHome + htAway);
    case "SECOND_HALF_TOTALS":        return totalsResult(label, shHome + shAway);
    case "FIRST_HALF_HANDICAP":       return handicapResult(label, htHome, htAway);
    case "SECOND_HALF_HANDICAP":      return handicapResult(label, shHome, shAway);
    case "CORNERS_TOTAL":             return corners ? totalsResult(label, corners.home + corners.away) : null;
    case "CORNERS_HANDICAP":          return corners ? handicapResult(label, corners.home, corners.away) : null;
    case "CARDS_TOTAL":               return cards ? totalsResult(label, cards.home + cards.away) : null;
    case "CARDS_HANDICAP":            return cards ? handicapResult(label, cards.home, cards.away) : null;
    // Pas de bouton "Autre" sur ce marché (volontaire) : le résultat ne serait
    // calculable que si on connaissait le reste de la grille proposée par le
    // trader, ce que cette fonction ne reçoit pas — plutôt limiter les lignes
    // offertes aux scores de mi-temps courants que risquer un règlement faux.
    case "HALF_TIME_CORRECT_SCORE":   return label === `${htHome}-${htAway}` ? "WON" : "LOST";
    case "HALF_TIME_FULL_TIME": {
      const computed = `${sideResult(htHome, htAway)}/${sideResult(ftHome, ftAway)}`;
      return label === computed ? "WON" : "LOST";
    }
    case "BOTH_HALVES_SCORE": {
      const m = label.match(/^(.+) (Oui|Non)$/);
      if (!m) return null;
      const [, team, answer] = m;
      const scoredBoth = team === homeTeam ? htHome > 0 && shHome > 0
        : team === awayTeam ? htAway > 0 && shAway > 0
        : null;
      if (scoredBoth === null) return null;
      return (answer === "Oui") === scoredBoth ? "WON" : "LOST";
    }
    case "SHOTS_ON_TARGET_TOTAL":     return shots ? totalsResult(label, shots.home + shots.away) : null;
    case "FOULS_TOTAL":               return fouls ? totalsResult(label, fouls.home + fouls.away) : null;
    default: return null;
  }
}
