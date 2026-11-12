// ─── Modèle de buts (Poisson) — génération automatique des cotes "Niveau 1" ──
//
// Principe : les marchés MATCH_WINNER et OVER_UNDER déjà synchronisés depuis
// TheOddsAPI sont de VRAIES cotes de marché. On en déduit le nombre de buts
// attendu de chaque équipe (λ_domicile, λ_extérieur) en supposant un modèle
// de Poisson indépendant (technique standard, ex. modèle de Maher 1982) :
// buts_domicile ~ Poisson(λ_dom), buts_extérieur ~ Poisson(λ_ext),
// indépendants. À partir de ces deux paramètres, on peut calculer la
// probabilité de N'IMPORTE QUEL marché exprimable comme fonction du score
// final (pair/impair, cage inviolée, victoire à zéro, marge de victoire,
// buts exacts par équipe).
//
// Simplification assumée : indépendance stricte des deux scores (le modèle
// de Dixon-Coles ajuste une légère corrélation sur les scores bas comme
// 0-0/1-0/0-1/1-1, mais l'écart reste faible) — à surveiller via une
// comparaison périodique avec d'autres plateformes plutôt qu'une sur-
// ingénierie dès le départ.

const MAX_GOALS = 8; // au-delà, probabilité négligeable (<0.1% pour λ réalistes)

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonPMF(k: number, lambda: number): number {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

export type ScoreGrid = number[][]; // grid[h][a] = P(score final = h-a)

/** Grille de probabilités jointe h×a, renormalisée après troncature à MAX_GOALS. */
export function buildScoreGrid(lambdaHome: number, lambdaAway: number): ScoreGrid {
  const homeP = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPMF(k, lambdaHome));
  const awayP = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPMF(k, lambdaAway));
  const sumHome = homeP.reduce((a, b) => a + b, 0);
  const sumAway = awayP.reduce((a, b) => a + b, 0);
  const grid: ScoreGrid = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    grid.push([]);
    for (let a = 0; a <= MAX_GOALS; a++) {
      grid[h].push((homeP[h] / sumHome) * (awayP[a] / sumAway));
    }
  }
  return grid;
}

function gridSum(grid: ScoreGrid, predicate: (h: number, a: number) => boolean): number {
  let p = 0;
  for (let h = 0; h < grid.length; h++) {
    for (let a = 0; a < grid[h].length; a++) {
      if (predicate(h, a)) p += grid[h][a];
    }
  }
  return p;
}

/**
 * Retrouve (λ_domicile, λ_extérieur) qui reproduisent au mieux les
 * probabilités observées sur le marché réel (1X2 + une ligne Plus/Moins),
 * par recherche en grille à précision croissante (rapide : quelques
 * centaines de milliers d'évaluations, pas besoin d'une vraie bibliothèque
 * d'optimisation pour 2 inconnues).
 */
export function fitLambdas(
  pHome: number, pDraw: number, pAway: number,
  overLine: number, pOver: number,
): { lambdaHome: number; lambdaAway: number } {
  function cost(lh: number, la: number): number {
    const grid = buildScoreGrid(lh, la);
    const mHome = gridSum(grid, (h, a) => h > a);
    const mDraw = gridSum(grid, (h, a) => h === a);
    const mAway = gridSum(grid, (h, a) => h < a);
    const mOver = gridSum(grid, (h, a) => h + a > overLine);
    return (mHome - pHome) ** 2 + (mDraw - pDraw) ** 2 + (mAway - pAway) ** 2 + (mOver - pOver) ** 2;
  }

  let best = { lh: 1.3, la: 1.1, c: Infinity };
  for (let lh = 0.2; lh <= 3.5; lh += 0.1) {
    for (let la = 0.2; la <= 3.5; la += 0.1) {
      const c = cost(lh, la);
      if (c < best.c) best = { lh, la, c };
    }
  }
  for (const step of [0.02, 0.005]) {
    const range = step * 10;
    const base = { ...best };
    for (let dh = -range; dh <= range; dh += step) {
      for (let da = -range; da <= range; da += step) {
        const lh = base.lh + dh, la = base.la + da;
        if (lh <= 0.05 || la <= 0.05) continue;
        const c = cost(lh, la);
        if (c < best.c) best = { lh, la, c };
      }
    }
  }
  return { lambdaHome: best.lh, lambdaAway: best.la };
}

/** 1/cote = probabilité implicite ; somme ramenée à 1 pour retirer la marge du bookmaker. */
export function devig(impliedOdds: number[]): number[] {
  const raw = impliedOdds.map((o) => 1 / o);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => p / sum);
}

// Plafond volontaire : sur un match très déséquilibré, l'issue la plus rare
// d'un marché comme "marge de victoire" peut avoir une cote "juste" de
// plusieurs centaines (ex. l'outsider gagne par 3+ buts) — mathématiquement
// correct, mais qui a l'air d'un bug pour un client et constitue un vrai
// risque si le modèle est légèrement mal calibré sur un cas extrême. Les
// bookmakers plafonnent eux aussi les marchés obscurs pour cette raison.
const ODD_CEILING = 100;

/** Probabilité → cote décimale, marge réintroduite, bornée entre un minimum et un maximum réalistes. */
export function probabilityToOdd(probability: number, marginPct: number): number {
  if (probability <= 0) return ODD_CEILING;
  const odd = 1 / (probability * (1 + marginPct));
  return Math.min(ODD_CEILING, Math.max(1.01, Math.round(odd * 100) / 100));
}

export interface DerivedOdd { label: string; value: number }

/**
 * Calcule les cotes des 5 marchés "Niveau 1" à partir de la grille de score.
 * homeTeam/awayTeam = noms exacts (utilisés dans les libellés, doivent
 * correspondre à Event.homeTeam/awayTeam pour que le règlement automatique
 * (computeItemResult) reconnaisse la sélection).
 */
export function deriveLevel1Markets(
  grid: ScoreGrid, homeTeam: string, awayTeam: string, marginPct: number,
): Record<string, DerivedOdd[]> {
  const homeMarginal = (k: number) => grid[k].reduce((a, b) => a + b, 0);
  const awayMarginal = (k: number) => grid.reduce((a, row) => a + row[k], 0);
  const toOdd = (p: number) => probabilityToOdd(p, marginPct);

  const pEven = gridSum(grid, (h, a) => (h + a) % 2 === 0);
  const ODD_EVEN_TOTAL: DerivedOdd[] = [
    { label: "Pair", value: toOdd(pEven) },
    { label: "Impair", value: toOdd(1 - pEven) },
  ];

  const pHomeCS = awayMarginal(0); // domicile garde sa cage inviolée ssi l'extérieur marque 0
  const pAwayCS = homeMarginal(0);
  const CLEAN_SHEET: DerivedOdd[] = [
    { label: `${homeTeam} Oui`, value: toOdd(pHomeCS) },
    { label: `${homeTeam} Non`, value: toOdd(1 - pHomeCS) },
    { label: `${awayTeam} Oui`, value: toOdd(pAwayCS) },
    { label: `${awayTeam} Non`, value: toOdd(1 - pAwayCS) },
  ];

  const pDraw0 = grid[0][0];
  const pHomeToNil = awayMarginal(0) - pDraw0;
  const pAwayToNil = homeMarginal(0) - pDraw0;
  const WIN_TO_NIL: DerivedOdd[] = [
    { label: `${homeTeam} Oui`, value: toOdd(pHomeToNil) },
    { label: `${homeTeam} Non`, value: toOdd(1 - pHomeToNil) },
    { label: `${awayTeam} Oui`, value: toOdd(pAwayToNil) },
    { label: `${awayTeam} Non`, value: toOdd(1 - pAwayToNil) },
  ];

  const marginBuckets: { label: string; predicate: (h: number, a: number) => boolean }[] = [
    { label: "1 (1)",  predicate: (h, a) => h - a === 1 },
    { label: "1 (2)",  predicate: (h, a) => h - a === 2 },
    { label: "1 (3+)", predicate: (h, a) => h - a >= 3 },
    { label: "X",      predicate: (h, a) => h === a },
    { label: "2 (1)",  predicate: (h, a) => a - h === 1 },
    { label: "2 (2)",  predicate: (h, a) => a - h === 2 },
    { label: "2 (3+)", predicate: (h, a) => a - h >= 3 },
  ];
  const WINNING_MARGIN: DerivedOdd[] = marginBuckets.map(({ label, predicate }) => ({
    label, value: toOdd(gridSum(grid, predicate)),
  }));

  const goalBuckets = (marginal: (k: number) => number, team: string): DerivedOdd[] => [
    { label: `${team} 0`,  value: toOdd(marginal(0)) },
    { label: `${team} 1`,  value: toOdd(marginal(1)) },
    { label: `${team} 2`,  value: toOdd(marginal(2)) },
    { label: `${team} 3+`, value: toOdd(1 - marginal(0) - marginal(1) - marginal(2)) },
  ];
  const TEAM_GOALS: DerivedOdd[] = [
    ...goalBuckets(homeMarginal, homeTeam),
    ...goalBuckets(awayMarginal, awayTeam),
  ];

  return { ODD_EVEN_TOTAL, CLEAN_SHEET, WIN_TO_NIL, WINNING_MARGIN, TEAM_GOALS };
}

// ─── "Niveau 2" — marchés combinés et par mi-temps ────────────────────────────
//
// Les 4 premiers (DOUBLE_CHANCE_BTTS, RESULT_BTTS, RESULT_TOTAL,
// DOUBLE_CHANCE_TOTAL) sont de simples croisements du résultat/total plein
// match avec le BTTS — aucune donnée supplémentaire requise, juste la même
// grille h×a que pour le Niveau 1.
//
// Les 7 suivants nécessitent de connaître la répartition des buts PAR
// MI-TEMPS, que la grille plein match ne donne pas. Plutôt que de calibrer
// un second modèle à partir de cotes mi-temps (pas toujours disponibles,
// et nécessiteraient d'attendre un cycle de sync différent — voir
// syncPropMarkets), on scinde λ_domicile/λ_extérieur selon une part fixe
// de buts marqués en 1ère mi-temps (~45%, statistique largement documentée
// dans le football) : simplification du même ordre que l'indépendance h/a
// déjà assumée plus haut — à surveiller plutôt qu'à sur-ingénierer dès le
// départ, et les deux mi-temps restent supposées indépendantes entre elles.
const FIRST_HALF_GOAL_SHARE = 0.45;

export function splitHalfLambdas(lambdaHome: number, lambdaAway: number) {
  return {
    lambdaHomeH1: lambdaHome * FIRST_HALF_GOAL_SHARE,
    lambdaAwayH1: lambdaAway * FIRST_HALF_GOAL_SHARE,
    lambdaHomeH2: lambdaHome * (1 - FIRST_HALF_GOAL_SHARE),
    lambdaAwayH2: lambdaAway * (1 - FIRST_HALF_GOAL_SHARE),
  };
}

/** P(total de buts = k) pour k = 0..2×MAX_GOALS, par anti-diagonale de la grille. */
function totalGoalsMarginal(grid: ScoreGrid): number[] {
  const maxK = (grid.length - 1) * 2;
  const dist = Array.from({ length: maxK + 1 }, () => 0);
  for (let h = 0; h < grid.length; h++) {
    for (let a = 0; a < grid[h].length; a++) dist[h + a] += grid[h][a];
  }
  return dist;
}

export function deriveLevel2Markets(
  grid: ScoreGrid, gridH1: ScoreGrid, gridH2: ScoreGrid,
  homeTeam: string, awayTeam: string, marginPct: number,
): Record<string, DerivedOdd[]> {
  const toOdd = (p: number) => probabilityToOdd(p, marginPct);
  const OVER_LINE = 2.5; // ligne standard — cohérent avec le libellé des marchés ("Total 2.5")
  const btts = (h: number, a: number) => h >= 1 && a >= 1;

  const DOUBLE_CHANCE_BTTS: DerivedOdd[] = [
    { label: "1X & Oui", value: toOdd(gridSum(grid, (h, a) => h >= a && btts(h, a))) },
    { label: "1X & Non", value: toOdd(gridSum(grid, (h, a) => h >= a && !btts(h, a))) },
    { label: "12 & Oui", value: toOdd(gridSum(grid, (h, a) => h !== a && btts(h, a))) },
    { label: "12 & Non", value: toOdd(gridSum(grid, (h, a) => h !== a && !btts(h, a))) },
    { label: "X2 & Oui", value: toOdd(gridSum(grid, (h, a) => h <= a && btts(h, a))) },
    { label: "X2 & Non", value: toOdd(gridSum(grid, (h, a) => h <= a && !btts(h, a))) },
  ];

  const RESULT_BTTS: DerivedOdd[] = [
    { label: "1 & Oui", value: toOdd(gridSum(grid, (h, a) => h > a && btts(h, a))) },
    { label: "1 & Non", value: toOdd(gridSum(grid, (h, a) => h > a && !btts(h, a))) },
    { label: "X & Oui", value: toOdd(gridSum(grid, (h, a) => h === a && btts(h, a))) },
    { label: "X & Non", value: toOdd(gridSum(grid, (h, a) => h === a && !btts(h, a))) },
    { label: "2 & Oui", value: toOdd(gridSum(grid, (h, a) => h < a && btts(h, a))) },
    { label: "2 & Non", value: toOdd(gridSum(grid, (h, a) => h < a && !btts(h, a))) },
  ];

  const RESULT_TOTAL: DerivedOdd[] = [
    { label: "1 & Plus 2.5",  value: toOdd(gridSum(grid, (h, a) => h > a && h + a > OVER_LINE)) },
    { label: "1 & Moins 2.5", value: toOdd(gridSum(grid, (h, a) => h > a && h + a < OVER_LINE)) },
    { label: "X & Plus 2.5",  value: toOdd(gridSum(grid, (h, a) => h === a && h + a > OVER_LINE)) },
    { label: "X & Moins 2.5", value: toOdd(gridSum(grid, (h, a) => h === a && h + a < OVER_LINE)) },
    { label: "2 & Plus 2.5",  value: toOdd(gridSum(grid, (h, a) => h < a && h + a > OVER_LINE)) },
    { label: "2 & Moins 2.5", value: toOdd(gridSum(grid, (h, a) => h < a && h + a < OVER_LINE)) },
  ];

  const DOUBLE_CHANCE_TOTAL: DerivedOdd[] = [
    { label: "1X & Plus 2.5",  value: toOdd(gridSum(grid, (h, a) => h >= a && h + a > OVER_LINE)) },
    { label: "1X & Moins 2.5", value: toOdd(gridSum(grid, (h, a) => h >= a && h + a < OVER_LINE)) },
    { label: "12 & Plus 2.5",  value: toOdd(gridSum(grid, (h, a) => h !== a && h + a > OVER_LINE)) },
    { label: "12 & Moins 2.5", value: toOdd(gridSum(grid, (h, a) => h !== a && h + a < OVER_LINE)) },
    { label: "X2 & Plus 2.5",  value: toOdd(gridSum(grid, (h, a) => h <= a && h + a > OVER_LINE)) },
    { label: "X2 & Moins 2.5", value: toOdd(gridSum(grid, (h, a) => h <= a && h + a < OVER_LINE)) },
  ];

  const halfTeamTotals = (halfGrid: ScoreGrid, team: string): DerivedOdd[] => {
    const homeMarginal = (k: number) => halfGrid[k].reduce((a, b) => a + b, 0);
    const awayMarginal = (k: number) => halfGrid.reduce((a, row) => a + row[k], 0);
    const marginal = team === homeTeam ? homeMarginal : awayMarginal;
    const pScores = 1 - marginal(0);
    return [
      { label: `${team} Plus 0.5`,  value: toOdd(pScores) },
      { label: `${team} Moins 0.5`, value: toOdd(1 - pScores) },
    ];
  };
  const FIRST_HALF_TEAM_TOTALS: DerivedOdd[]  = [...halfTeamTotals(gridH1, homeTeam), ...halfTeamTotals(gridH1, awayTeam)];
  const SECOND_HALF_TEAM_TOTALS: DerivedOdd[] = [...halfTeamTotals(gridH2, homeTeam), ...halfTeamTotals(gridH2, awayTeam)];

  const halfOddEven = (halfGrid: ScoreGrid): DerivedOdd[] => {
    const pEven = gridSum(halfGrid, (h, a) => (h + a) % 2 === 0);
    return [{ label: "Pair", value: toOdd(pEven) }, { label: "Impair", value: toOdd(1 - pEven) }];
  };
  const FIRST_HALF_ODD_EVEN: DerivedOdd[]  = halfOddEven(gridH1);
  const SECOND_HALF_ODD_EVEN: DerivedOdd[] = halfOddEven(gridH2);

  // Mi-temps indépendantes (même simplification que ci-dessus) : la
  // distribution du total de buts de chaque mi-temps se combine en croisant
  // simplement les deux distributions 1D plutôt qu'une grille jointe 2D.
  const distH1 = totalGoalsMarginal(gridH1);
  const distH2 = totalGoalsMarginal(gridH2);
  let pH1Higher = 0, pH2Higher = 0, pHalvesEqual = 0;
  for (let t1 = 0; t1 < distH1.length; t1++) {
    for (let t2 = 0; t2 < distH2.length; t2++) {
      const p = distH1[t1] * distH2[t2];
      if (t1 > t2) pH1Higher += p;
      else if (t2 > t1) pH2Higher += p;
      else pHalvesEqual += p;
    }
  }
  const HIGHEST_SCORING_HALF: DerivedOdd[] = [
    { label: "1ère mi-temps", value: toOdd(pH1Higher) },
    { label: "2nde mi-temps", value: toOdd(pH2Higher) },
    { label: "Égalité",       value: toOdd(pHalvesEqual) },
  ];

  const pBttsH1 = gridSum(gridH1, btts);
  const pBttsH2 = gridSum(gridH2, btts);
  const BTTS_BOTH_HALVES: DerivedOdd[] = [
    { label: "Oui / Oui", value: toOdd(pBttsH1 * pBttsH2) },
    { label: "Oui / Non", value: toOdd(pBttsH1 * (1 - pBttsH2)) },
    { label: "Non / Oui", value: toOdd((1 - pBttsH1) * pBttsH2) },
    { label: "Non / Non", value: toOdd((1 - pBttsH1) * (1 - pBttsH2)) },
  ];

  const pHomeWinsH1 = gridSum(gridH1, (h, a) => h > a);
  const pAwayWinsH1 = gridSum(gridH1, (h, a) => h < a);
  const pHomeWinsH2 = gridSum(gridH2, (h, a) => h > a);
  const pAwayWinsH2 = gridSum(gridH2, (h, a) => h < a);
  const pSameTeamBothHalves = pHomeWinsH1 * pHomeWinsH2 + pAwayWinsH1 * pAwayWinsH2;
  const WIN_BOTH_HALVES: DerivedOdd[] = [
    { label: "Oui", value: toOdd(pSameTeamBothHalves) },
    { label: "Non", value: toOdd(1 - pSameTeamBothHalves) },
  ];

  return {
    DOUBLE_CHANCE_BTTS, RESULT_BTTS, RESULT_TOTAL, DOUBLE_CHANCE_TOTAL,
    FIRST_HALF_TEAM_TOTALS, SECOND_HALF_TEAM_TOTALS,
    FIRST_HALF_ODD_EVEN, SECOND_HALF_ODD_EVEN,
    HIGHEST_SCORING_HALF, BTTS_BOTH_HALVES, WIN_BOTH_HALVES,
  };
}

// ─── Complément des lignes Plus/Moins manquantes ──────────────────────────────
//
// Signalé par l'utilisateur le 12/11/2026 : TheOddsAPI ne fournit pas
// toujours la gamme standard de lignes (0.5 à 5.5) pour chaque match —
// certains n'ont que 2.5/3.5, par exemple. Ça concentre les combinés sur
// "Plus 2.5" (ligne à forte fréquence de réussite dans le foot moderne,
// donc risquée en accumulation) sans alternative plus fine pour le
// parieur. Mêmes lignes que celles déjà gardées pour alternate_totals
// (voir ALTERNATE_TOTALS_MAX_LINES, odds.service.ts).
const STANDARD_TOTAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];

/**
 * Calcule Plus/Moins pour chaque ligne standard ABSENTE de existingLines —
 * à écrire dans le marché ALTERNATE_TOTALS, qui laissera la vraie cote de
 * TheOddsAPI reprendre la main dès qu'elle devient disponible pour cette
 * ligne (upsertExtraMarkets fait un update si la cote existe déjà).
 */
export function deriveMissingTotalLines(
  grid: ScoreGrid, existingLines: number[], marginPct: number,
): DerivedOdd[] {
  const toOdd = (p: number) => probabilityToOdd(p, marginPct);
  const odds: DerivedOdd[] = [];
  for (const line of STANDARD_TOTAL_LINES) {
    if (existingLines.includes(line)) continue;
    const pOver = gridSum(grid, (h, a) => h + a > line);
    odds.push({ label: `Plus ${line}`, value: toOdd(pOver) });
    odds.push({ label: `Moins ${line}`, value: toOdd(1 - pOver) });
  }
  return odds;
}
