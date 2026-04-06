import type { Match, Ranking } from './ftcscout';

export type EventPhase =
  | 'QUALS_RUNNING'
  | 'QUALS_DONE_SELECTION_PENDING'
  | 'ALLIANCE_SELECTION_OR_POSTED'
  | 'PLAYOFFS_RUNNING'
  | 'EVENT_COMPLETE';

export function detectEventPhase(matches: Match[]): EventPhase {
  if (!matches || matches.length === 0) return 'QUALS_RUNNING';

  const quals = matches.filter(m => m.tournamentLevel === 'QUAL');
  const playoffs = matches.filter(m =>
    ['PLAYOFF', 'SEMIFINAL', 'FINAL'].includes(m.tournamentLevel)
  );

  const qualsPlayed = quals.filter(m => m.played);
  const playoffsPlayed = playoffs.filter(m => m.played);

  if (quals.length === 0 && playoffs.length === 0) return 'QUALS_RUNNING';
  if (quals.length > 0 && qualsPlayed.length < quals.length) return 'QUALS_RUNNING';
  if (quals.length > 0 && qualsPlayed.length === quals.length && playoffs.length === 0) return 'QUALS_DONE_SELECTION_PENDING';
  if (playoffs.length > 0 && playoffsPlayed.length < playoffs.length) return 'PLAYOFFS_RUNNING';
  if (playoffs.length > 0 && playoffsPlayed.length === playoffs.length) return 'EVENT_COMPLETE';
  return 'QUALS_DONE_SELECTION_PENDING';
}

export interface TeamMetrics {
  teamNumber: number;
  teamName: string;
  expectedAuto: number;
  expectedTeleop: number;
  expectedEndgame: number;
  expectedPenalties: number;
  totalExpected: number;
  consistency: number;
  reliabilityIndex: number;
  trend: number;
  matchCount: number;
  scores: number[];
  stddev?: number;
  recentScores?: number[];
  opr?: number;
  autoOpr?: number;
  teleopOpr?: number;
  endgameOpr?: number;
}

// ─── Math helpers ────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function iqr(arr: number[]): number {
  if (arr.length < 4) return stddev(arr);
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return q3 - q1;
}

// Gaussian elimination with partial pivoting for OPR least-squares solve
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-10) continue;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map((row, i) => (Math.abs(aug[i][i]) > 1e-10 ? row[n] / row[i] : 0));
}

// ─── OPR ─────────────────────────────────────────────────────────────────────

export interface OPRResult {
  totalOpr: number;
  autoOpr: number;
  teleopOpr: number;
  endgameOpr: number;
}

/**
 * Compute Offensive Power Ratings for all teams at an event.
 * Uses least-squares regression (normal equations) to distribute alliance
 * scores among individual team contributions.
 */
export function computeOPR(teamList: number[], matches: Match[]): Map<number, OPRResult> {
  if (teamList.length === 0) return new Map();

  const teamIndex = new Map(teamList.map((t, i) => [t, i]));
  const n = teamList.length;
  const playedMatches = matches.filter(m => m.played && m.tournamentLevel === 'QUAL');
  if (playedMatches.length === 0) return new Map();

  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb_total = new Array<number>(n).fill(0);
  const Atb_auto = new Array<number>(n).fill(0);
  const Atb_teleop = new Array<number>(n).fill(0);
  const Atb_endgame = new Array<number>(n).fill(0);

  for (const match of playedMatches) {
    for (const color of ['Red', 'Blue'] as const) {
      const alliance = match.teams.filter(t => t.alliance === color && !t.dq);
      const scores = color === 'Red' ? match.scores?.red : match.scores?.blue;
      if (!scores) continue;

      const indices = alliance
        .map(t => teamIndex.get(t.teamNumber))
        .filter((i): i is number => i !== undefined);

      for (const i of indices) {
        Atb_total[i] += scores.totalPoints ?? 0;
        Atb_auto[i] += scores.autoPoints ?? 0;
        Atb_teleop[i] += scores.dcPoints ?? 0;
        Atb_endgame[i] += scores.endgamePoints ?? 0;
        for (const j of indices) AtA[i][j]++;
      }
    }
  }

  const opr_total = gaussianElimination(AtA.map(r => [...r]), [...Atb_total]);
  const opr_auto = gaussianElimination(AtA.map(r => [...r]), [...Atb_auto]);
  const opr_teleop = gaussianElimination(AtA.map(r => [...r]), [...Atb_teleop]);
  const opr_endgame = gaussianElimination(AtA.map(r => [...r]), [...Atb_endgame]);

  return new Map(
    teamList.map((t, i) => [
      t,
      {
        totalOpr: opr_total[i] ?? 0,
        autoOpr: opr_auto[i] ?? 0,
        teleopOpr: opr_teleop[i] ?? 0,
        endgameOpr: opr_endgame[i] ?? 0,
      },
    ])
  );
}

// ─── Team metrics ─────────────────────────────────────────────────────────────

export function computeTeamMetrics(teamNumber: number, matches: Match[], teamName = ''): TeamMetrics {
  const quals = matches.filter(m => m.tournamentLevel === 'QUAL' && m.played);
  const teamMatches = quals.filter(m => m.teams.some(t => t.teamNumber === teamNumber));

  const autos: number[] = [];
  const telops: number[] = [];
  const endgames: number[] = [];
  const penalties: number[] = [];
  const totals: number[] = [];

  for (const match of teamMatches) {
    const teamEntry = match.teams.find(t => t.teamNumber === teamNumber);
    if (!teamEntry || teamEntry.dq) continue;
    const alliance = teamEntry.alliance?.toLowerCase() as 'red' | 'blue';
    const scores = match.scores?.[alliance];
    if (!scores) continue;
    autos.push(scores.autoPoints ?? 0);
    telops.push(scores.dcPoints ?? 0);
    endgames.push(scores.endgamePoints ?? 0);
    penalties.push(scores.penaltyPointsCommitted ?? 0);
    totals.push(scores.totalPoints ?? 0);
  }

  const n = totals.length;
  const eventMeanAuto = mean(quals.flatMap(m => [m.scores?.red?.autoPoints ?? 0, m.scores?.blue?.autoPoints ?? 0]));
  const eventMeanTeleop = mean(quals.flatMap(m => [m.scores?.red?.dcPoints ?? 0, m.scores?.blue?.dcPoints ?? 0]));
  const eventMeanEndgame = mean(quals.flatMap(m => [m.scores?.red?.endgamePoints ?? 0, m.scores?.blue?.endgamePoints ?? 0]));

  const shrink = (vals: number[], eventMean: number) => {
    if (!vals.length) return eventMean;
    const alpha = Math.min(n, 5) / 5;
    return alpha * mean(vals) + (1 - alpha) * eventMean;
  };

  const expectedAuto = shrink(autos, eventMeanAuto);
  const expectedTeleop = shrink(telops, eventMeanTeleop);
  const expectedEndgame = shrink(endgames, eventMeanEndgame);
  const expectedPenalties = mean(penalties);
  const totalExpected = expectedAuto + expectedTeleop + expectedEndgame;

  const consistency = iqr(totals);
  const sd = stddev(totals);
  const cv = totalExpected > 0 ? sd / totalExpected : 1;
  const reliabilityIndex = Math.max(0, Math.min(100, 100 - cv * 100));

  let trend = 0;
  if (totals.length >= 2) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < totals.length; i++) {
      const w = Math.pow(0.5, totals.length - 1 - i);
      weightedSum += totals[i] * w;
      totalWeight += w;
    }
    trend = weightedSum / totalWeight - mean(totals);
  }

  const recentScores = totals.slice(-6);

  return {
    teamNumber,
    teamName,
    expectedAuto,
    expectedTeleop,
    expectedEndgame,
    expectedPenalties,
    totalExpected,
    consistency,
    reliabilityIndex,
    trend,
    matchCount: n,
    scores: totals,
    stddev: sd,
    recentScores,
  };
}

// ─── Synergy ──────────────────────────────────────────────────────────────────

export interface SynergyScore {
  teamA: number;
  teamB: number;
  complementarity: number;
  overlapPenalty: number;
  synergyScore: number;
}

/**
 * Compute role-fingerprint synergy using all three scoring phases.
 * Complementarity rewards teams that fill different phase roles;
 * overlapPenalty discourages role collision on the same phase.
 */
export function computeSynergy(metricsA: TeamMetrics, metricsB: TeamMetrics): SynergyScore {
  const totalA = metricsA.totalExpected || 1;
  const totalB = metricsB.totalExpected || 1;
  const combined = metricsA.totalExpected + metricsB.totalExpected;

  // Role fingerprints (fraction of score per phase)
  const fpA = {
    auto: metricsA.expectedAuto / totalA,
    teleop: metricsA.expectedTeleop / totalA,
    endgame: metricsA.expectedEndgame / totalA,
  };
  const fpB = {
    auto: metricsB.expectedAuto / totalB,
    teleop: metricsB.expectedTeleop / totalB,
    endgame: metricsB.expectedEndgame / totalB,
  };

  // Euclidean distance in role-fingerprint space → high distance = complementary
  const dist = Math.sqrt(
    (fpA.auto - fpB.auto) ** 2 +
    (fpA.teleop - fpB.teleop) ** 2 +
    (fpA.endgame - fpB.endgame) ** 2
  );

  // Max distance in 3D simplex ≈ √2
  const complementarity = (dist / Math.SQRT2) * 60;

  // Penalise when both teams dominate the same phase
  const maxOverlap = Math.max(
    Math.min(fpA.auto, fpB.auto),
    Math.min(fpA.teleop, fpB.teleop),
    Math.min(fpA.endgame, fpB.endgame)
  );
  const overlapPenalty = maxOverlap * 20;

  const synergyScore = combined + complementarity - overlapPenalty;

  return { teamA: metricsA.teamNumber, teamB: metricsB.teamNumber, complementarity, overlapPenalty, synergyScore };
}

// ─── Monte Carlo ──────────────────────────────────────────────────────────────

export function simulateWinProbability(
  allianceA: TeamMetrics[],
  allianceB: TeamMetrics[],
  simulations = 1000
): { winProbability: number; expectedMargin: number; upsetRisk: number } {
  if (allianceA.length === 0 && allianceB.length === 0) return { winProbability: 0.5, expectedMargin: 0, upsetRisk: 1 };
  if (allianceB.length === 0) return { winProbability: 1, expectedMargin: allianceA.reduce((s, m) => s + m.totalExpected, 0), upsetRisk: 0 };

  let wins = 0;
  let totalMargin = 0;
  let closeCalls = 0;

  const NOISE_FLOOR = 0.05;
  const MIN_SD = 1;

  const sample = (m: TeamMetrics) => {
    const sd = Math.max(
      m.stddev ?? stddev(m.scores.length >= 2 ? m.scores : [m.totalExpected]),
      m.totalExpected * NOISE_FLOOR + MIN_SD
    );
    // Box-Muller transform for Gaussian sample
    const u = Math.max(1e-10, Math.random());
    const v = Math.random();
    const gauss = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, m.totalExpected + gauss * sd);
  };

  for (let i = 0; i < simulations; i++) {
    const scoreA = allianceA.reduce((s, m) => s + sample(m), 0);
    const scoreB = allianceB.reduce((s, m) => s + sample(m), 0);
    const margin = scoreA - scoreB;
    totalMargin += margin;
    if (scoreA > scoreB) wins++;
    if (Math.abs(margin) <= 10) closeCalls++;
  }

  return {
    winProbability: wins / simulations,
    expectedMargin: totalMargin / simulations,
    upsetRisk: closeCalls / simulations,
  };
}

// ─── Picklist filters ─────────────────────────────────────────────────────────

// ─── Picklist filter thresholds ───────────────────────────────────────────────
const AUTO_HEAVY_THRESHOLD        = 0.32;  // auto score / total > this → "auto heavy"
const TELEOP_HEAVY_THRESHOLD      = 0.50;  // teleop score / total > this → "teleop heavy"
const ENDGAME_HEAVY_THRESHOLD     = 0.20;  // endgame score / total > this → "endgame heavy"
const LOW_PENALTY_THRESHOLD       = 5;     // avg penalty pts below this → "low penalties"
const HIGH_RELIABILITY_THRESHOLD  = 70;    // reliability index ≥ this → "high reliability"
const HIGH_CEILING_SCORE_THRESHOLD= 80;    // total expected ≥ this → "high ceiling"
const HIGH_CEILING_TREND_THRESHOLD= 5;     // or trend ≥ this → "high ceiling"
const TRENDING_UP_THRESHOLD       = 3;     // trend ≥ this → "trending up"

export type PicklistFilter =
  | 'ALL'
  | 'AUTO_HEAVY'
  | 'TELEOP_HEAVY'
  | 'ENDGAME_HEAVY'
  | 'LOW_PENALTIES'
  | 'HIGH_RELIABILITY'
  | 'HIGH_CEILING'
  | 'TRENDING_UP';

export function filterPicklist(picks: PickRecommendation[], filter: PicklistFilter): PickRecommendation[] {
  if (filter === 'ALL') return picks;
  return picks.filter(pick => {
    const m = pick.metrics;
    const total = m.totalExpected || 1;
    switch (filter) {
      case 'AUTO_HEAVY':      return m.expectedAuto / total > AUTO_HEAVY_THRESHOLD;
      case 'TELEOP_HEAVY':    return m.expectedTeleop / total > TELEOP_HEAVY_THRESHOLD;
      case 'ENDGAME_HEAVY':   return m.expectedEndgame / total > ENDGAME_HEAVY_THRESHOLD;
      case 'LOW_PENALTIES':   return m.expectedPenalties < LOW_PENALTY_THRESHOLD;
      case 'HIGH_RELIABILITY':return m.reliabilityIndex >= HIGH_RELIABILITY_THRESHOLD;
      case 'HIGH_CEILING':    return m.totalExpected > HIGH_CEILING_SCORE_THRESHOLD || m.trend > HIGH_CEILING_TREND_THRESHOLD;
      case 'TRENDING_UP':     return m.trend > TRENDING_UP_THRESHOLD;
      default:                return true;
    }
  });
}

// ─── Picklist generation ──────────────────────────────────────────────────────

export type PicklistMode = 'SAFE' | 'BALANCED' | 'CEILING' | 'COUNTER';

export interface PickRecommendation {
  teamNumber: number;
  teamName: string;
  score: number;
  rank: number;
  factors: string[];
  confidence: number;
  warnings: string[];
  metrics: TeamMetrics;
  synergyScore: SynergyScore;
  winProbability?: number;
}

export function generatePicklist(
  captainMetrics: TeamMetrics,
  candidates: TeamMetrics[],
  mode: PicklistMode
): PickRecommendation[] {
  const scored = candidates
    .filter(c => c.teamNumber !== captainMetrics.teamNumber)
    .map(candidate => {
      const synergy = computeSynergy(captainMetrics, candidate);
      let score = 0;
      const factors: string[] = [];
      const warnings: string[] = [];

      switch (mode) {
        case 'SAFE':
          score = candidate.reliabilityIndex * 0.5 + candidate.totalExpected * 0.3 + synergy.synergyScore * 0.2;
          if (candidate.reliabilityIndex > 70) factors.push(`Reliability ${candidate.reliabilityIndex.toFixed(0)}%`);
          if (candidate.consistency < 15) factors.push('Very consistent scores');
          if (synergy.overlapPenalty < 5) factors.push('Low role collision risk');
          break;
        case 'BALANCED':
          score = candidate.totalExpected * 0.4 + synergy.synergyScore * 0.35 + candidate.reliabilityIndex * 0.25;
          if (synergy.complementarity > 20) factors.push('Strong role complementarity');
          if (candidate.totalExpected > captainMetrics.totalExpected * 0.8) factors.push('High scoring output');
          if (candidate.reliabilityIndex > 60) factors.push(`${candidate.reliabilityIndex.toFixed(0)}% reliable`);
          break;
        case 'CEILING':
          score = candidate.totalExpected * 0.6 + candidate.trend * 2 + synergy.synergyScore * 0.2;
          if (candidate.trend > 5) factors.push(`↑ Trending +${candidate.trend.toFixed(1)} pts`);
          if (candidate.totalExpected > 100) factors.push('High peak score potential');
          if (candidate.reliabilityIndex < 50) warnings.push('High variance scorer');
          break;
        case 'COUNTER':
          score = candidate.expectedAuto * 0.5 + candidate.expectedEndgame * 0.3 + candidate.totalExpected * 0.2;
          if (candidate.expectedAuto > 25) factors.push(`Auto: ${candidate.expectedAuto.toFixed(0)} avg pts`);
          if (candidate.expectedEndgame > 15) factors.push(`Endgame: ${candidate.expectedEndgame.toFixed(0)} avg pts`);
          break;
      }

      if (candidate.matchCount < 3) warnings.push('Limited data (< 3 matches)');
      if (candidate.trend < -10) warnings.push('Declining trend');
      if (candidate.expectedPenalties > 8) warnings.push('High penalty risk');
      if (factors.length === 0) factors.push('Solid overall contributor');

      const confidence = Math.min(100, candidate.matchCount * 12 + candidate.reliabilityIndex * 0.4);

      // Quick win probability with 500 sims for ranking purposes
      const wp = simulateWinProbability([captainMetrics, candidate], [], 500);

      return {
        teamNumber: candidate.teamNumber,
        teamName: candidate.teamName,
        score,
        rank: 0,
        factors,
        confidence,
        warnings,
        metrics: candidate,
        synergyScore: synergy,
        winProbability: wp.winProbability,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return scored;
}

// ─── Alliance pitches ─────────────────────────────────────────────────────────

export interface AlliancePitch {
  captainTeam: number;
  captainName: string;
  fitScore: number;
  whyTheyNeedYou: string[];
  talkingPoints: string[];
  redFlags: string[];
  winProbabilityIncrease: number;
  confidence: number;
  synergy: SynergyScore;
  captainRank: number;
}

export function generateAlliancePitches(
  myMetrics: TeamMetrics,
  allTeamMetrics: TeamMetrics[],
  rankings: Ranking[]
): AlliancePitch[] {
  const captainRankings = rankings
    .filter(r => r.rank <= 4)
    .sort((a, b) => a.rank - b.rank);

  return captainRankings.map(captainRanking => {
    const captainMetrics = allTeamMetrics.find(t => t.teamNumber === captainRanking.teamNumber);
    if (!captainMetrics) {
      return {
        captainTeam: captainRanking.teamNumber,
        captainName: captainRanking.teamName,
        fitScore: 50,
        whyTheyNeedYou: ['Adds scoring depth to alliance'],
        talkingPoints: [`Team ${myMetrics.teamNumber} averages ${myMetrics.totalExpected.toFixed(0)} pts/match`],
        redFlags: [],
        winProbabilityIncrease: 0,
        confidence: 30,
        synergy: { teamA: captainRanking.teamNumber, teamB: myMetrics.teamNumber, complementarity: 0, overlapPenalty: 0, synergyScore: 0 },
        captainRank: captainRanking.rank,
      };
    }

    const synergy = computeSynergy(captainMetrics, myMetrics);
    const withoutMe = simulateWinProbability([captainMetrics], [], 500);
    const withMe = simulateWinProbability([captainMetrics, myMetrics], [], 500);
    const winIncrease = (withMe.winProbability - withoutMe.winProbability) * 100;

    const whyTheyNeedYou: string[] = [];
    const talkingPoints: string[] = [];
    const redFlags: string[] = [];

    // Auto comparison
    if (myMetrics.expectedAuto > captainMetrics.expectedAuto * 1.1) {
      whyTheyNeedYou.push('Stronger autonomous than captain');
      talkingPoints.push(`Our auto averages ${myMetrics.expectedAuto.toFixed(0)} pts vs their ${captainMetrics.expectedAuto.toFixed(0)} pts`);
    }
    // Endgame comparison
    if (myMetrics.expectedEndgame > captainMetrics.expectedEndgame * 1.1) {
      whyTheyNeedYou.push('Outperforms captain in endgame');
      talkingPoints.push(`Endgame avg ${myMetrics.expectedEndgame.toFixed(0)} pts (${((myMetrics.expectedEndgame / myMetrics.totalExpected) * 100).toFixed(0)}% of our score)`);
    }
    // Teleop
    if (myMetrics.expectedTeleop > captainMetrics.expectedTeleop * 1.1) {
      whyTheyNeedYou.push('Higher teleop output than captain');
      talkingPoints.push(`Teleop avg ${myMetrics.expectedTeleop.toFixed(0)} pts/match`);
    }
    // Complementarity
    if (synergy.complementarity > 25) {
      whyTheyNeedYou.push('Complementary scoring profile — covers captain\'s gaps');
    }
    // Reliability
    if (myMetrics.reliabilityIndex > 70) {
      talkingPoints.push(`${myMetrics.reliabilityIndex.toFixed(0)}% reliability index — consistent every match`);
    }
    // Trend
    if (myMetrics.trend > 5) {
      talkingPoints.push(`Improving: +${myMetrics.trend.toFixed(1)} pts trend this event`);
    }
    // Win increase
    if (winIncrease > 5) {
      talkingPoints.push(`Adding us raises your win probability by ~${winIncrease.toFixed(0)}%`);
    }

    // Red flags
    if (myMetrics.matchCount < 3) redFlags.push('Limited data (< 3 qual matches)');
    if (myMetrics.reliabilityIndex < 40) redFlags.push('High scoring variance');
    if (myMetrics.expectedPenalties > 8) redFlags.push(`Penalty risk — avg ${myMetrics.expectedPenalties.toFixed(0)} pts committed`);
    if (myMetrics.trend < -8) redFlags.push('Declining trend this event');

    if (whyTheyNeedYou.length === 0) whyTheyNeedYou.push('Adds reliable scoring depth');
    if (talkingPoints.length === 0) talkingPoints.push(`Averaged ${myMetrics.totalExpected.toFixed(0)} pts/match this event`);

    // Fit score: normalise synergy score against a 200-pt reference
    const fitScore = Math.max(0, Math.min(100, (synergy.synergyScore / 250) * 100));

    return {
      captainTeam: captainRanking.teamNumber,
      captainName: captainRanking.teamName,
      fitScore,
      whyTheyNeedYou,
      talkingPoints,
      redFlags,
      winProbabilityIncrease: Math.max(0, winIncrease),
      confidence: Math.min(100, myMetrics.matchCount * 15 + 20),
      synergy,
      captainRank: captainRanking.rank,
    };
  });
}
