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
}

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

export function computeTeamMetrics(teamNumber: number, matches: Match[], teamName = ''): TeamMetrics {
  const quals = matches.filter(
    m => m.tournamentLevel === 'QUAL' && m.played
  );

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
  const eventMeanAuto = mean(quals.flatMap(m =>
    [m.scores?.red?.autoPoints ?? 0, m.scores?.blue?.autoPoints ?? 0]
  ));
  const eventMeanTeleop = mean(quals.flatMap(m =>
    [m.scores?.red?.dcPoints ?? 0, m.scores?.blue?.dcPoints ?? 0]
  ));
  const eventMeanEndgame = mean(quals.flatMap(m =>
    [m.scores?.red?.endgamePoints ?? 0, m.scores?.blue?.endgamePoints ?? 0]
  ));

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
  const cv = totalExpected > 0 ? stddev(totals) / totalExpected : 1;
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
    const recent = weightedSum / totalWeight;
    trend = recent - mean(totals);
  }

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
  };
}

export interface SynergyScore {
  teamA: number;
  teamB: number;
  complementarity: number;
  overlapPenalty: number;
  synergyScore: number;
}

export function computeSynergy(metricsA: TeamMetrics, metricsB: TeamMetrics): SynergyScore {
  const totalA = metricsA.totalExpected;
  const totalB = metricsB.totalExpected;
  const combined = totalA + totalB;

  const autoRatioA = totalA > 0 ? metricsA.expectedAuto / totalA : 0;
  const autoRatioB = totalB > 0 ? metricsB.expectedAuto / totalB : 0;
  const complementarity = Math.abs(autoRatioA - autoRatioB) * 50;

  const overlapPenalty = (1 - Math.abs(autoRatioA - autoRatioB)) * 10;

  const synergyScore = combined + complementarity - overlapPenalty;

  return {
    teamA: metricsA.teamNumber,
    teamB: metricsB.teamNumber,
    complementarity,
    overlapPenalty,
    synergyScore,
  };
}

export function simulateWinProbability(
  allianceA: TeamMetrics[],
  allianceB: TeamMetrics[],
  simulations = 1000
): { winProbability: number; expectedMargin: number; upsetRisk: number } {
  let wins = 0;
  let totalMargin = 0;
  let closeCalls = 0;

  const NOISE_FLOOR_PERCENTAGE = 0.05;
  const MIN_STANDARD_DEVIATION = 1;

  const sample = (m: TeamMetrics) => {
    const sd = Math.max(
      stddev(m.scores.length >= 2 ? m.scores : [m.totalExpected]),
      m.totalExpected * NOISE_FLOOR_PERCENTAGE + MIN_STANDARD_DEVIATION
    );
    return Math.max(0, m.totalExpected + (Math.random() - 0.5) * 2 * sd);
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
          if (candidate.reliabilityIndex > 70) factors.push('High reliability');
          if (candidate.consistency < 15) factors.push('Very consistent scores');
          break;
        case 'BALANCED':
          score = candidate.totalExpected * 0.4 + synergy.synergyScore * 0.35 + candidate.reliabilityIndex * 0.25;
          if (synergy.complementarity > 20) factors.push('Good role complementarity');
          if (candidate.totalExpected > captainMetrics.totalExpected * 0.8) factors.push('Strong scorer');
          break;
        case 'CEILING':
          score = candidate.totalExpected * 0.6 + candidate.trend * 2 + synergy.synergyScore * 0.2;
          if (candidate.trend > 5) factors.push('Improving trend');
          if (candidate.totalExpected > 100) factors.push('High ceiling scorer');
          if (candidate.reliabilityIndex < 50) warnings.push('Inconsistent performance');
          break;
        case 'COUNTER':
          score = candidate.expectedAuto * 0.5 + candidate.expectedEndgame * 0.3 + candidate.totalExpected * 0.2;
          if (candidate.expectedAuto > 30) factors.push('Strong autonomous');
          if (candidate.expectedEndgame > 20) factors.push('Strong endgame');
          break;
      }

      if (candidate.matchCount < 3) warnings.push('Limited match data');
      if (candidate.trend < -10) warnings.push('Declining performance');
      if (factors.length === 0) factors.push('Solid overall contributor');

      const confidence = Math.min(100, candidate.matchCount * 15 + candidate.reliabilityIndex * 0.5);

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
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return scored;
}

export interface AlliancePitch {
  captainTeam: number;
  captainName: string;
  fitScore: number;
  whyTheyNeedYou: string[];
  talkingPoints: string[];
  redFlags: string[];
  winProbabilityIncrease: number;
  confidence: number;
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
        talkingPoints: [`Team ${myMetrics.teamNumber} can contribute consistently`],
        redFlags: [],
        winProbabilityIncrease: 0,
        confidence: 30,
      };
    }

    const synergy = computeSynergy(captainMetrics, myMetrics);
    const withoutMe = simulateWinProbability([captainMetrics], [], 500);
    const withMe = simulateWinProbability([captainMetrics, myMetrics], [], 500);
    const winIncrease = (withMe.winProbability - withoutMe.winProbability) * 100;

    const whyTheyNeedYou: string[] = [];
    const talkingPoints: string[] = [];
    const redFlags: string[] = [];

    if (myMetrics.expectedAuto > captainMetrics.expectedAuto) {
      whyTheyNeedYou.push('Stronger autonomous routine than captain');
      talkingPoints.push(`Our auto averages ${myMetrics.expectedAuto.toFixed(0)} pts vs their ${captainMetrics.expectedAuto.toFixed(0)} pts`);
    }
    if (myMetrics.expectedEndgame > captainMetrics.expectedEndgame) {
      whyTheyNeedYou.push('Better endgame performance');
      talkingPoints.push(`We average ${myMetrics.expectedEndgame.toFixed(0)} endgame points`);
    }
    if (synergy.complementarity > 20) {
      whyTheyNeedYou.push('Complementary scoring profile');
    }
    if (myMetrics.reliabilityIndex > 70) {
      talkingPoints.push(`${myMetrics.reliabilityIndex.toFixed(0)}% reliability index - we show up every match`);
    }
    if (myMetrics.trend > 5) {
      talkingPoints.push('Performance has been improving each match');
    }
    if (myMetrics.matchCount < 3) {
      redFlags.push('Limited match data may affect evaluation');
    }
    if (myMetrics.reliabilityIndex < 40) {
      redFlags.push('Inconsistent scoring history');
    }
    if (whyTheyNeedYou.length === 0) {
      whyTheyNeedYou.push('Provides reliable scoring depth');
    }
    if (talkingPoints.length === 0) {
      talkingPoints.push(`Averaged ${myMetrics.totalExpected.toFixed(0)} pts/match this event`);
    }

    const fitScore = Math.min(100, (synergy.synergyScore / 200) * 100);

    return {
      captainTeam: captainRanking.teamNumber,
      captainName: captainRanking.teamName,
      fitScore,
      whyTheyNeedYou,
      talkingPoints,
      redFlags,
      winProbabilityIncrease: Math.max(0, winIncrease),
      confidence: Math.min(100, myMetrics.matchCount * 15 + 20),
    };
  });
}
