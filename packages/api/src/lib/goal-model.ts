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

/** Probabilité → cote décimale, marge réintroduite, bornée à un minimum réaliste. */
export function probabilityToOdd(probability: number, marginPct: number): number {
  if (probability <= 0) return 999; // ne devrait jamais arriver en pratique (score grid tronquée large)
  const odd = 1 / (probability * (1 + marginPct));
  return Math.max(1.01, Math.round(odd * 100) / 100);
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
  const pNeitherToNil = 1 - pHomeToNil - pAwayToNil;
  const WIN_TO_NIL: DerivedOdd[] = [
    { label: "1", value: toOdd(pHomeToNil) },
    { label: "2", value: toOdd(pAwayToNil) },
    { label: "Non", value: toOdd(pNeitherToNil) },
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
