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
  scoreStd: number;          // sample std-dev of per-match alliance scores
  scoreStdN: number;         // sample size (== matchCount, exposed for UI)
}

export interface SynergyResult {
  score: number;
  combinedExpected: number;
  complementarity: number;
  overlapPenalty: number;
  captainFingerprint: [number, number, number]; // normalized [auto, dc, endgame]
  pickFingerprint: [number, number, number];
  gapFilledAxis: "auto" | "dc" | "endgame" | null; // dimension improved most
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
export type CaptainArchetype = "balanced" | "auto_heavy" | "ceiling" | "safe";

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
    scoreStd: std(scores),
    scoreStdN: matchCount,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export function computeSynergy(captain: TeamMetrics, pick: TeamMetrics): SynergyResult {
  const totalCap = captain.avgAuto + captain.avgDc + captain.avgEndgame || 1;
  const totalPick = pick.avgAuto + pick.avgDc + pick.avgEndgame || 1;

  const fpCap: [number, number, number] = [captain.avgAuto / totalCap, captain.avgDc / totalCap, captain.avgEndgame / totalCap];
  const fpPick: [number, number, number] = [pick.avgAuto / totalPick, pick.avgDc / totalPick, pick.avgEndgame / totalPick];

  const euclidean = Math.sqrt(fpCap.reduce((s, v, i) => s + (v - fpPick[i]) ** 2, 0));
  const complementarity = clamp((euclidean / Math.SQRT2) * 60, 0, 60);

  const overlap = Math.min(...fpCap.map((v, i) => Math.min(v, fpPick[i])));
  const overlapPenalty = clamp(overlap * 20, 0, 20);

  const combinedExpected = captain.avgTotal + pick.avgTotal;

  // Determine which axis the pick fills best (biggest gap from captain)
  const gaps = [
    { axis: "auto" as const, gap: fpPick[0] - fpCap[0] },
    { axis: "dc" as const, gap: fpPick[1] - fpCap[1] },
    { axis: "endgame" as const, gap: fpPick[2] - fpCap[2] },
  ];
  const bestGap = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
  const gapFilledAxis: SynergyResult["gapFilledAxis"] = bestGap.gap > 0.05 ? bestGap.axis : null;

  return {
    score: clamp(combinedExpected + complementarity - overlapPenalty, 0, Infinity),
    combinedExpected,
    complementarity,
    overlapPenalty,
    captainFingerprint: fpCap,
    pickFingerprint: fpPick,
    gapFilledAxis,
  };
}

export type MonteCarloScenario = "optimistic" | "nominal" | "pessimistic";

const SCENARIO_MULTIPLIER: Record<MonteCarloScenario, number> = {
  optimistic: 0.6,
  nominal: 1.0,
  pessimistic: 1.5,
};

// Box-Muller
function sampleGaussian(mean: number, sd: number): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random() || 1e-10;
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export interface MonteCarloResult {
  redWin: number;
  blueWin: number;
  tie: number;
  redWinCI: number;   // half-width of 95% CI
  blueWinCI: number;
}

export function monteCarlo(
  red: TeamMetrics[],
  blue: TeamMetrics[],
  runs = 1000,
  scenario: MonteCarloScenario = "nominal"
): MonteCarloResult {
  const mult = SCENARIO_MULTIPLIER[scenario];
  let redWin = 0, blueWin = 0, tie = 0;
  for (let i = 0; i < runs; i++) {
    const rs = red.reduce((s, t) => {
      const sigma = Math.max((t.scoreStd / 2) * mult, 3);
      return s + sampleGaussian(t.opr, sigma);
    }, 0);
    const bs = blue.reduce((s, t) => {
      const sigma = Math.max((t.scoreStd / 2) * mult, 3);
      return s + sampleGaussian(t.opr, sigma);
    }, 0);
    if (rs > bs) redWin++;
    else if (bs > rs) blueWin++;
    else tie++;
  }
  const rp = redWin / runs;
  const bp = blueWin / runs;
  // Normal approximation 95% CI half-width: 1.96 * sqrt(p*(1-p)/n)
  const redWinCI = clamp(1.96 * Math.sqrt((rp * (1 - rp)) / runs), 0, 0.5);
  const blueWinCI = clamp(1.96 * Math.sqrt((bp * (1 - bp)) / runs), 0, 0.5);
  return { redWin: rp, blueWin: bp, tie: tie / runs, redWinCI, blueWinCI };
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

// ─── Alliance Role Determination ──────────────────────────────────────────────

export interface AllianceRole {
  role: "captain" | "picked" | "borderline";
  rank: number;
  numAlliances: number;
}

export function estimateNumAlliances(totalTeams: number): number {
  if (totalTeams <= 8) return 2;
  if (totalTeams <= 12) return 3;
  if (totalTeams <= 20) return 4;
  if (totalTeams <= 32) return 6;
  return 8;
}

export function determineRole(rank: number, totalTeams: number): AllianceRole {
  const numAlliances = estimateNumAlliances(totalTeams);
  if (rank <= numAlliances) return { role: "captain", rank, numAlliances };
  if (rank <= numAlliances + 2) return { role: "borderline", rank, numAlliances };
  return { role: "picked", rank, numAlliances };
}

// ─── Alliance Strength (pairwise synergy across all team pairs) ────────────────

export function computeAllianceStrength(teams: TeamMetrics[]): number {
  if (!teams.length) return 0;
  const totalOPR = teams.reduce((s, t) => s + t.opr, 0);
  if (teams.length === 1) return totalOPR;
  let bonus = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const s = computeSynergy(teams[i], teams[j]);
      bonus += s.complementarity - s.overlapPenalty;
    }
  }
  const pairs = (teams.length * (teams.length - 1)) / 2;
  return totalOPR + (bonus / pairs) * 0.4;
}

// ─── Alliance Pick Optimization (for captains) ────────────────────────────────

export interface PickOption {
  teamNumber: number;
  metrics: TeamMetrics;
  synergy: SynergyResult;
  /** Projected 3-team alliance strength (with best available pick 2) */
  allianceStrength: number;
  bestPick2: { teamNumber: number; metrics: TeamMetrics; allianceStrength: number } | null;
  reasons: string[];
  label: string;
}

export function optimizePick1(
  captainMetrics: TeamMetrics,
  availableMetrics: TeamMetrics[],
  topN = 5
): PickOption[] {
  const others = availableMetrics.filter((m) => m.teamNumber !== captainMetrics.teamNumber);
  return others
    .map((pick1) => {
      const synergy1 = computeSynergy(captainMetrics, pick1);
      const pick2Pool = others.filter((m) => m.teamNumber !== pick1.teamNumber);
      let bestPick2: PickOption["bestPick2"] = null;
      let bestStrength = computeAllianceStrength([captainMetrics, pick1]);
      for (const pick2 of pick2Pool) {
        const s = computeAllianceStrength([captainMetrics, pick1, pick2]);
        if (s > bestStrength) {
          bestStrength = s;
          bestPick2 = { teamNumber: pick2.teamNumber, metrics: pick2, allianceStrength: s };
        }
      }
      const reasons: string[] = [];
      if (pick1.opr > captainMetrics.opr * 0.75)
        reasons.push(`High OPR: ${pick1.opr.toFixed(0)}`);
      if (synergy1.complementarity > 25)
        reasons.push(`Fills scoring gaps (+${synergy1.complementarity.toFixed(0)} syn)`);
      if (pick1.reliability > 75)
        reasons.push(`Reliable: ${pick1.reliability.toFixed(0)}/100`);
      if (pick1.trend > 1) reasons.push(`Trending up`);
      if (pick1.avgAuto > 20) reasons.push(`Auto specialist: ${pick1.avgAuto.toFixed(0)} avg`);
      if (pick1.avgEndgame > 15) reasons.push(`Strong endgame: ${pick1.avgEndgame.toFixed(0)} avg`);
      if (!reasons.length) reasons.push(`Avg total: ${pick1.avgTotal.toFixed(0)} pts`);
      const label =
        pick1.trend > 2 ? "📈 Trending Up" :
        pick1.reliability > 80 ? "🛡 Reliable" :
        pick1.avgTotal > 120 ? "🚀 High Ceiling" : "⚖️ Balanced";
      return { teamNumber: pick1.teamNumber, metrics: pick1, synergy: synergy1, allianceStrength: bestStrength, bestPick2, reasons, label };
    })
    .sort((a, b) => b.allianceStrength - a.allianceStrength)
    .slice(0, topN);
}

// ─── Pitch Strategy (for teams being picked) ──────────────────────────────────

export interface CaptainApproach {
  captainNumber: number;
  captainMetrics: TeamMetrics;
  synergyWithMe: SynergyResult;
  /** How much stronger the captain's alliance would be with me vs without me */
  improvementDelta: number;
  allianceStrengthWithMe: number;
  allianceStrengthWithoutMe: number;
  pitchPoints: string[];
  redFlags: string[];
  pickLikelihood: "high" | "medium" | "low";
}

export function rankCaptainsToApproach(
  myMetrics: TeamMetrics,
  captainMetrics: TeamMetrics[],
  allMetrics: TeamMetrics[]
): CaptainApproach[] {
  return captainMetrics
    .filter((c) => c.teamNumber !== myMetrics.teamNumber)
    .map((captain) => {
      const synergyWithMe = computeSynergy(captain, myMetrics);
      const pool = allMetrics.filter(
        (m) => m.teamNumber !== captain.teamNumber && m.teamNumber !== myMetrics.teamNumber
      );
      // Best 2 picks WITHOUT me
      const sortedPool = [...pool].sort((a, b) => {
        const sa = computeSynergy(captain, a);
        const sb = computeSynergy(captain, b);
        return b.opr + sb.complementarity - (a.opr + sa.complementarity);
      });
      const p1w = sortedPool[0];
      const p2w = p1w
        ? [...pool]
            .filter((m) => m.teamNumber !== p1w.teamNumber)
            .sort((a, b) =>
              computeAllianceStrength([captain, p1w, b]) -
              computeAllianceStrength([captain, p1w, a])
            )[0]
        : undefined;
      const strengthWithout = p2w
        ? computeAllianceStrength([captain, p1w, p2w])
        : p1w
        ? computeAllianceStrength([captain, p1w])
        : captain.opr;
      // Best pick 2 WITH me
      const p2with = [...pool].sort(
        (a, b) =>
          computeAllianceStrength([captain, myMetrics, b]) -
          computeAllianceStrength([captain, myMetrics, a])
      )[0];
      const strengthWith = p2with
        ? computeAllianceStrength([captain, myMetrics, p2with])
        : computeAllianceStrength([captain, myMetrics]);
      const improvementDelta = strengthWith - strengthWithout;
      const pitchPoints: string[] = [];
      if (synergyWithMe.complementarity > 25)
        pitchPoints.push(`Fills your scoring gap — ${synergyWithMe.complementarity.toFixed(0)} synergy pts`);
      if (myMetrics.avgAuto > captain.avgAuto * 0.75)
        pitchPoints.push(`Strong autonomous: ${myMetrics.avgAuto.toFixed(0)} avg pts`);
      if (myMetrics.avgEndgame > 15)
        pitchPoints.push(`Reliable endgame: ${myMetrics.avgEndgame.toFixed(0)} avg pts`);
      if (myMetrics.reliability > 75)
        pitchPoints.push(`Reliability score: ${myMetrics.reliability.toFixed(0)}/100`);
      if (myMetrics.trend > 1)
        pitchPoints.push(`Improving every match — positive trend`);
      if (improvementDelta > 5)
        pitchPoints.push(`Adds +${improvementDelta.toFixed(0)} projected alliance strength`);
      if (!pitchPoints.length)
        pitchPoints.push(`OPR contribution: ${myMetrics.opr.toFixed(0)}`);
      const redFlags: string[] = [];
      if (myMetrics.matchCount < 5) redFlags.push(`Small sample (${myMetrics.matchCount} matches)`);
      if (myMetrics.consistency < 50) redFlags.push(`High variance performer`);
      if (myMetrics.avgEndgame < 5) redFlags.push(`Weak endgame contribution`);
      const teamsAboveMe = pool.filter((m) => m.opr > myMetrics.opr).length;
      const pickLikelihood: CaptainApproach["pickLikelihood"] =
        teamsAboveMe <= 2 ? "high" : teamsAboveMe <= 5 ? "medium" : "low";
      return {
        captainNumber: captain.teamNumber,
        captainMetrics: captain,
        synergyWithMe,
        improvementDelta,
        allianceStrengthWithMe: strengthWith,
        allianceStrengthWithoutMe: strengthWithout,
        pitchPoints,
        redFlags,
        pickLikelihood,
      };
    })
    .sort((a, b) => b.improvementDelta - a.improvementDelta);
}

// ─── Snake Draft Simulation ────────────────────────────────────────────────────
// Models the FTC 2-round snake draft.  Round 1: captains pick in rank order.
// Round 2: reversed.  This lets us tell a captain exactly which targets will
// realistically still be on the board when their turn arrives.

function archetypePickScore(
  alliance: TeamMetrics[],
  candidate: TeamMetrics,
  archetype: CaptainArchetype
): number {
  const newAlliance = [...alliance, candidate];
  const baseStrength = computeAllianceStrength(newAlliance);
  switch (archetype) {
    case "auto_heavy": {
      const totalAuto = newAlliance.reduce((s, t) => s + t.avgAuto, 0);
      return baseStrength * 0.6 + totalAuto * 1.5;
    }
    case "ceiling":
      return newAlliance.reduce((s, t) => Math.max(s, t.opr), 0) * 1.5 + baseStrength * 0.5;
    case "safe": {
      const maxStd = newAlliance.reduce((s, t) => Math.max(s, t.scoreStd ?? 0), 0);
      const totalRely = newAlliance.reduce((s, t) => s + t.reliability, 0);
      return baseStrength - maxStd * 0.3 + totalRely * 0.1;
    }
    default: // balanced
      return baseStrength;
  }
}

function simulateGreedyPick(
  captain: TeamMetrics,
  captainAlliances: Map<number, TeamMetrics[]>,
  available: Set<number>,
  pool: TeamMetrics[],
  archetype: CaptainArchetype = "balanced"
): void {
  const alliance = captainAlliances.get(captain.teamNumber) ?? [captain];
  let bestTeam: number | null = null;
  let bestScore = -Infinity;
  for (const t of available) {
    const tm = pool.find((m) => m.teamNumber === t);
    if (!tm) continue;
    const s = archetypePickScore(alliance, tm, archetype);
    if (s > bestScore) {
      bestScore = s;
      bestTeam = t;
    }
  }
  if (bestTeam !== null) {
    available.delete(bestTeam);
    const tm = pool.find((m) => m.teamNumber === bestTeam);
    if (tm) captainAlliances.get(captain.teamNumber)?.push(tm);
  }
}

/**
 * Returns the set of non-captain teams still available when:
 *  - `pick1Available`: it's your first pick (round 1, slot `myCaptainRank`)
 *  - `pick2Available`: it's your second pick (round 2, reversed slot)
 *
 * Assumes every other captain picks greedily using the specified archetype.
 */
export function simulateDraftAvailability(
  myCaptainRank: number,              // 1-indexed
  captainMetricsList: TeamMetrics[],  // all captains in rank order (index 0 = rank 1)
  allAvailableMetrics: TeamMetrics[], // non-captain teams
  archetype: CaptainArchetype = "balanced"
): { pick1Available: Set<number>; pick2Available: Set<number> } {
  const n = captainMetricsList.length;
  const myIdx = myCaptainRank - 1; // 0-indexed

  const available = new Set(allAvailableMetrics.map((m) => m.teamNumber));
  const captainAlliances = new Map(
    captainMetricsList.map((c) => [c.teamNumber, [c] as TeamMetrics[]])
  );

  // Round 1 — captains 0..myIdx-1 pick before me
  for (let i = 0; i < myIdx; i++) {
    simulateGreedyPick(captainMetricsList[i], captainAlliances, available, allAvailableMetrics, archetype);
  }
  const pick1Available = new Set(available);

  // Simulate my own pick (choose best available to leave realistic round-2 pool)
  simulateGreedyPick(captainMetricsList[myIdx], captainAlliances, available, allAvailableMetrics, "balanced");

  // Round 1 continues — captains myIdx+1..n-1 pick
  for (let i = myIdx + 1; i < n; i++) {
    simulateGreedyPick(captainMetricsList[i], captainAlliances, available, allAvailableMetrics, archetype);
  }

  // Round 2 — reversed order; captains n-1..myIdx+1 pick before me
  for (let i = n - 1; i > myIdx; i--) {
    simulateGreedyPick(captainMetricsList[i], captainAlliances, available, allAvailableMetrics, archetype);
  }
  const pick2Available = new Set(available);

  return { pick1Available, pick2Available };
}

/** Enhanced pick list that annotates each option with draft-availability and sensitivity. */
export interface DraftAwarePickOption extends PickOption {
  availableForPick1: boolean;
  availableForPick2: boolean;
  availabilityTag: string;
  sensitivityTag: "robust" | "fragile" | "unknown";
  sensitivityNote: string;
}

const ALL_ARCHETYPES: CaptainArchetype[] = ["balanced", "auto_heavy", "ceiling", "safe"];

export function optimizePicksWithDraft(
  captainMetrics: TeamMetrics,
  myCaptainRank: number,
  allCaptainMetrics: TeamMetrics[],
  availableMetrics: TeamMetrics[],
  topN = 5,
  archetype: CaptainArchetype = "balanced"
): DraftAwarePickOption[] {
  const { pick1Available, pick2Available } = simulateDraftAvailability(
    myCaptainRank,
    allCaptainMetrics,
    availableMetrics,
    archetype
  );

  // Sensitivity: check pick1 availability under each archetype for top N+10
  const pick1ByArchetype = new Map<CaptainArchetype, Set<number>>(
    ALL_ARCHETYPES.map((a) => [
      a,
      simulateDraftAvailability(myCaptainRank, allCaptainMetrics, availableMetrics, a).pick1Available,
    ])
  );

  const raw = optimizePick1(captainMetrics, availableMetrics, topN + 10);
  return raw
    .map((p) => {
      const a1 = pick1Available.has(p.teamNumber);
      const a2 = pick2Available.has(p.teamNumber);
      const availabilityTag = a1 ? "✓ Available for Pick 1" : a2 ? "⚠ Available for Pick 2 only" : "✗ Likely gone";

      // Sensitivity: count how many archetypes leave this pick available for pick 1
      const robustCount = ALL_ARCHETYPES.filter((a) => pick1ByArchetype.get(a)?.has(p.teamNumber)).length;
      const sensitivityTag: DraftAwarePickOption["sensitivityTag"] =
        !a1 && !a2 ? "unknown" : robustCount >= 3 ? "robust" : "fragile";
      const sensitivityNote =
        sensitivityTag === "robust"
          ? "robust across archetypes"
          : sensitivityTag === "fragile"
          ? "sensitive to captain style"
          : "likely unavailable";

      return { ...p, availableForPick1: a1, availableForPick2: a2, availabilityTag, sensitivityTag, sensitivityNote };
    })
    .sort((a, b) => {
      const aScore = a.availableForPick1 ? 2 : a.availableForPick2 ? 1 : 0;
      const bScore = b.availableForPick1 ? 2 : b.availableForPick2 ? 1 : 0;
      if (bScore !== aScore) return bScore - aScore;
      return b.allianceStrength - a.allianceStrength;
    })
    .slice(0, topN);
}

// ─── Win-probability matchups ──────────────────────────────────────────────────

export interface AllianceMatchup {
  opponentCaptain: number;
  opponentTeams: number[];
  winProbability: number;  // probability MY alliance wins
  winProbabilityCI: number; // 95% CI half-width
  strengthDelta: number;   // my projected strength minus theirs
}

/** For a completed (or projected) alliance, compute win probability against each other alliance. */
export function computeMatchups(
  myAlliance: TeamMetrics[],
  opponentAlliances: { captain: number; teams: TeamMetrics[] }[],
  runs = 2000,
  scenario: MonteCarloScenario = "nominal"
): AllianceMatchup[] {
  const myStrength = computeAllianceStrength(myAlliance);
  return opponentAlliances.map((opp) => {
    const result = monteCarlo(myAlliance, opp.teams, runs, scenario);
    return {
      opponentCaptain: opp.captain,
      opponentTeams: opp.teams.map((t) => t.teamNumber),
      winProbability: result.redWin,
      winProbabilityCI: result.redWinCI,
      strengthDelta: myStrength - computeAllianceStrength(opp.teams),
    };
  });
}
