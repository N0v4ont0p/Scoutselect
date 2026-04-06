import type { FTCMatch } from "./ftcscout";

export interface TeamMetrics {
  teamNumber: number;
  matchCount: number;
  avgTotal: number;
  avgAuto: number;
  avgDc: number;
  avgEndgame: number;
  opr: number;
  consistency: number;       // 0–100 (higher = more consistent)
  reliability: number;       // 0–100 composite
  trend: number;             // slope of score vs match index
  sparkline: number[];       // per-match total scores
  warnings: string[];
}

export interface SynergyResult {
  score: number;
  combinedExpected: number;
  complementarity: number;
  overlapPenalty: number;
}

export interface PicklistEntry {
  teamNumber: number;
  score: number;
  label: string;
  metrics: TeamMetrics;
  synergy: SynergyResult;
}

export type PicklistMode = "safe" | "balanced" | "ceiling" | "counter";
export type PicklistFilter = "auto" | "dc" | "endgame" | "lowPenalty" | "reliable" | "ceiling" | "trending";

export interface PitchCard {
  captainNumber: number;
  teamNumber: number;
  winProbBefore: number;
  winProbAfter: number;
  talkingPoints: string[];
  redFlags: string[];
}

export type EventPhase = "quals_running" | "alliance_selection" | "playoffs_running" | "complete" | "upcoming";

// ---------- Gaussian elimination OPR ----------
function gaussianElim(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-10) continue;
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    if (Math.abs(M[row][row]) < 1e-10) continue;
    x[row] = M[row][n];
    for (let col = row + 1; col < n; col++) x[row] -= M[row][col] * x[col];
    x[row] /= M[row][row];
  }
  return x;
}

export function computeOPR(matches: FTCMatch[], teams: number[]): Map<number, number> {
  if (!teams.length || !matches.length) return new Map();
  const idx = new Map(teams.map((t, i) => [t, i]));
  const n = teams.length;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);

  for (const m of matches) {
    if (m.tournamentLevel !== "Quals") continue;
    const sides: [number[], number | null][] = [
      [m.redTeams, m.redScore],
      [m.blueTeams, m.blueScore],
    ];
    for (const [alliance, score] of sides) {
      if (score == null) continue;
      const idxs = alliance.map((t) => idx.get(t)).filter((i): i is number => i !== undefined);
      for (const i of idxs) {
        b[i] += score;
        for (const j of idxs) A[i][j]++;
      }
    }
  }
  const oprs = gaussianElim(A, b);
  return new Map(teams.map((t, i) => [t, oprs[i] ?? 0]));
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// std is exported for potential future use
export function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (arr.length - 1));
}

function linearTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const xs = values.map((_, i) => i);
  const xm = avg(xs), ym = avg(values);
  const num = xs.reduce((s, x, i) => s + (x - xm) * (values[i] - ym), 0);
  const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

export function buildTeamMetrics(
  teamNumber: number,
  matches: FTCMatch[],
  eventMedianTotal: number
): TeamMetrics {
  const scores: number[] = [];
  const autoScores: number[] = [];
  const dcScores: number[] = [];
  const egScores: number[] = [];

  for (const m of matches) {
    if (m.tournamentLevel !== "Quals") continue;
    const onRed = m.redTeams.includes(teamNumber);
    const onBlue = m.blueTeams.includes(teamNumber);
    if (!onRed && !onBlue) continue;

    // Per-team contribution: alliance score used for ranking, breakdown divided by 2
    const alliance = onRed ? "red" : "blue";
    const total = alliance === "red" ? (m.redScore ?? 0) : (m.blueScore ?? 0);
    scores.push(total);
    // Use per-match breakdown split evenly since we don't have per-robot scores
    autoScores.push(m.autoPoints / 2);
    dcScores.push(m.dcPoints / 2);
    egScores.push(m.endgamePoints / 2);
  }

  const matchCount = scores.length;
  const warnings: string[] = [];
  if (matchCount === 0) warnings.push("No qualification matches found");
  if (matchCount < 5) warnings.push(`Only ${matchCount} qual matches — estimates may be unreliable`);

  // Bayesian shrinkage
  const alpha = Math.min(matchCount, 5) / 5;
  const observed = avg(scores);
  const shrunk = alpha * observed + (1 - alpha) * eventMedianTotal;

  // Consistency via IQR (inverted — low IQR = high consistency)
  const sorted = [...scores].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const q3 = sorted[Math.ceil(sorted.length * 0.75)] ?? 0;
  const iqr = q3 - q1;
  const maxPossible = 400;
  const consistency = clamp(100 - (iqr / maxPossible) * 100, 0, 100);

  const reliability = clamp((consistency * 0.6 + (matchCount >= 5 ? 40 : matchCount * 8)), 0, 100);
  const trend = linearTrend(scores);

  return {
    teamNumber,
    matchCount,
    avgTotal: shrunk,
    avgAuto: avg(autoScores),
    avgDc: avg(dcScores),
    avgEndgame: avg(egScores),
    opr: shrunk, // will be overwritten by computeOPR if available
    consistency,
    reliability,
    trend,
    sparkline: scores.slice(-10),
    warnings,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export function computeSynergy(captain: TeamMetrics, pick: TeamMetrics): SynergyResult {
  const totalCap = captain.avgAuto + captain.avgDc + captain.avgEndgame || 1;
  const totalPick = pick.avgAuto + pick.avgDc + pick.avgEndgame || 1;

  const fpCap = [captain.avgAuto / totalCap, captain.avgDc / totalCap, captain.avgEndgame / totalCap];
  const fpPick = [pick.avgAuto / totalPick, pick.avgDc / totalPick, pick.avgEndgame / totalPick];

  const euclidean = Math.sqrt(fpCap.reduce((s, v, i) => s + (v - fpPick[i]) ** 2, 0));
  const complementarity = clamp((euclidean / Math.SQRT2) * 60, 0, 60);

  const overlap = Math.min(...fpCap.map((v, i) => Math.min(v, fpPick[i])));
  const overlapPenalty = clamp(overlap * 20, 0, 20);

  const combinedExpected = captain.avgTotal + pick.avgTotal;

  return {
    score: clamp(combinedExpected + complementarity - overlapPenalty, 0, Infinity),
    combinedExpected,
    complementarity,
    overlapPenalty,
  };
}

// Box-Muller
function sampleGaussian(mean: number, sd: number): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random() || 1e-10;
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function monteCarlo(
  red: TeamMetrics[],
  blue: TeamMetrics[],
  runs = 1000
): { redWin: number; blueWin: number; tie: number } {
  let redWin = 0, blueWin = 0, tie = 0;
  for (let i = 0; i < runs; i++) {
    const rs = red.reduce((s, t) => s + sampleGaussian(t.avgTotal / 2, t.consistency > 0 ? t.avgTotal * (1 - t.consistency / 100) / 2 : 5), 0);
    const bs = blue.reduce((s, t) => s + sampleGaussian(t.avgTotal / 2, t.consistency > 0 ? t.avgTotal * (1 - t.consistency / 100) / 2 : 5), 0);
    if (rs > bs) redWin++;
    else if (bs > rs) blueWin++;
    else tie++;
  }
  return { redWin: redWin / runs, blueWin: blueWin / runs, tie: tie / runs };
}

const PICKLIST_WEIGHTS: Record<PicklistMode, [number, number, number, number]> = {
  safe:     [0.4, 0.2, 0.2, 0.2],
  balanced: [0.25, 0.25, 0.25, 0.25],
  ceiling:  [0.1, 0.1, 0.1, 0.7],
  counter:  [0.3, 0.4, 0.1, 0.2],
};

export function generatePicklist(
  captainNumber: number,
  allMetrics: TeamMetrics[],
  mode: PicklistMode = "balanced",
  filters: PicklistFilter[] = []
): PicklistEntry[] {
  const captain = allMetrics.find((m) => m.teamNumber === captainNumber);
  if (!captain) return [];

  const [wTotal, wAuto, wDc, wEg] = PICKLIST_WEIGHTS[mode];

  return allMetrics
    .filter((m) => m.teamNumber !== captainNumber)
    .filter((m) => {
      if (filters.includes("auto") && m.avgAuto < 10) return false;
      if (filters.includes("dc") && m.avgDc < 10) return false;
      if (filters.includes("endgame") && m.avgEndgame < 5) return false;
      if (filters.includes("reliable") && m.reliability < 60) return false;
      if (filters.includes("ceiling") && m.avgTotal < 80) return false;
      if (filters.includes("trending") && m.trend < 0) return false;
      return true;
    })
    .map((m) => {
      const synergy = computeSynergy(captain, m);
      const rawScore =
        wTotal * m.avgTotal +
        wAuto * m.avgAuto * 3 +
        wDc * m.avgDc * 3 +
        wEg * m.avgEndgame * 3 +
        synergy.complementarity * 0.5;

      const label = picklistLabel(m, mode);
      return { teamNumber: m.teamNumber, score: rawScore, label, metrics: m, synergy };
    })
    .sort((a, b) => b.score - a.score);
}

function picklistLabel(m: TeamMetrics, mode: PicklistMode): string {
  if (mode === "safe" && m.reliability > 80) return "🛡 Reliable";
  if (mode === "ceiling" && m.avgTotal > 120) return "🚀 High Ceiling";
  if (mode === "counter" && m.avgAuto > 20) return "🎯 Auto Specialist";
  if (m.trend > 2) return "📈 Trending Up";
  if (m.consistency > 80) return "✅ Consistent";
  return "⚖️ Balanced";
}

export function generatePitches(
  teamNumber: number,
  captains: TeamMetrics[],
  allMetrics: TeamMetrics[]
): PitchCard[] {
  const self = allMetrics.find((m) => m.teamNumber === teamNumber);
  if (!self) return [];

  return captains
    .filter((c) => c.teamNumber !== teamNumber)
    .slice(0, 4)
    .map((captain) => {
      const synergy = computeSynergy(captain, self);

      const before = monteCarlo([captain], [], 200);
      const after = monteCarlo([captain, self], [], 200);

      const talkingPoints: string[] = [];
      if (self.avgAuto > captain.avgAuto * 0.8) talkingPoints.push(`Strong autonomous — avg ${self.avgAuto.toFixed(0)} pts`);
      if (self.avgEndgame > 15) talkingPoints.push(`Reliable endgame — avg ${self.avgEndgame.toFixed(0)} pts`);
      if (self.reliability > 75) talkingPoints.push(`Reliability score ${self.reliability.toFixed(0)}/100`);
      if (synergy.complementarity > 30) talkingPoints.push(`High synergy — different scoring profile fills gaps`);
      if (self.trend > 1) talkingPoints.push(`Improving each match — positive trend`);
      if (!talkingPoints.length) talkingPoints.push(`Avg total score: ${self.avgTotal.toFixed(0)} pts`);

      const redFlags: string[] = [];
      if (self.matchCount < 5) redFlags.push(`Small sample size (${self.matchCount} matches)`);
      if (self.consistency < 50) redFlags.push("High score variance — inconsistent performer");
      if (self.avgEndgame < 5) redFlags.push("Weak endgame contribution");

      return {
        captainNumber: captain.teamNumber,
        teamNumber,
        winProbBefore: before.redWin,
        winProbAfter: after.redWin,
        talkingPoints,
        redFlags,
      };
    });
}

export function detectPhase(
  totalMatches: number,
  qualMatches: number,
  playoffMatches: number
): EventPhase {
  if (totalMatches === 0) return "upcoming";
  if (playoffMatches > 0 && qualMatches > 0) {
    if (playoffMatches >= 13) return "complete";
    return "playoffs_running";
  }
  if (qualMatches > 0 && playoffMatches === 0) {
    if (qualMatches >= totalMatches * 0.95) return "alliance_selection";
    return "quals_running";
  }
  return "upcoming";
}
