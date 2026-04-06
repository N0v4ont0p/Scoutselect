import {
  detectEventPhase,
  computeTeamMetrics,
  computeSynergy,
  generatePicklist,
  simulateWinProbability,
  type TeamMetrics,
} from '@/lib/analytics';
import type { Match } from '@/lib/ftcscout';

function makeMatch(
  id: string,
  level: string,
  played: boolean,
  teams: { teamNumber: number; alliance: 'Red' | 'Blue'; dq?: boolean }[],
  redScore = 100,
  blueScore = 90
): Match {
  return {
    id,
    matchNum: parseInt(id),
    series: 1,
    tournamentLevel: level,
    played,
    teams: teams.map(t => ({
      teamNumber: t.teamNumber,
      station: t.alliance === 'Red' ? 'Red1' : 'Blue1',
      dq: t.dq ?? false,
      surrogate: false,
      alliance: t.alliance,
    })),
    scores: played
      ? {
          red: { totalPoints: redScore, autoPoints: 30, dcPoints: 50, endgamePoints: 20, penaltyPointsCommitted: 0 },
          blue: { totalPoints: blueScore, autoPoints: 25, dcPoints: 45, endgamePoints: 20, penaltyPointsCommitted: 0 },
        }
      : undefined,
    winner: played ? (redScore > blueScore ? 'Red' : 'Blue') : undefined,
  };
}

describe('detectEventPhase', () => {
  it('returns QUALS_RUNNING with no matches', () => {
    expect(detectEventPhase([])).toBe('QUALS_RUNNING');
  });

  it('returns QUALS_RUNNING when quals not all played', () => {
    const matches = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('2', 'QUAL', false, [{ teamNumber: 3, alliance: 'Red' }, { teamNumber: 4, alliance: 'Blue' }]),
    ];
    expect(detectEventPhase(matches)).toBe('QUALS_RUNNING');
  });

  it('returns QUALS_DONE_SELECTION_PENDING when all quals played', () => {
    const matches = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('2', 'QUAL', true, [{ teamNumber: 3, alliance: 'Red' }, { teamNumber: 4, alliance: 'Blue' }]),
    ];
    expect(detectEventPhase(matches)).toBe('QUALS_DONE_SELECTION_PENDING');
  });

  it('returns PLAYOFFS_RUNNING when playoffs started', () => {
    const matches = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('2', 'PLAYOFF', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('3', 'PLAYOFF', false, [{ teamNumber: 3, alliance: 'Red' }, { teamNumber: 4, alliance: 'Blue' }]),
    ];
    expect(detectEventPhase(matches)).toBe('PLAYOFFS_RUNNING');
  });

  it('returns PLAYOFFS_RUNNING when ELIM matches started (FTCScout API level)', () => {
    const matches = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('2', 'ELIM', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('3', 'ELIM', false, [{ teamNumber: 3, alliance: 'Red' }, { teamNumber: 4, alliance: 'Blue' }]),
    ];
    expect(detectEventPhase(matches)).toBe('PLAYOFFS_RUNNING');
  });

  it('returns EVENT_COMPLETE when all playoffs done', () => {
    const matches = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('2', 'PLAYOFF', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
    ];
    expect(detectEventPhase(matches)).toBe('EVENT_COMPLETE');
  });

  it('returns EVENT_COMPLETE when all ELIM matches done (FTCScout API level)', () => {
    const matches = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
      makeMatch('2', 'ELIM', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }]),
    ];
    expect(detectEventPhase(matches)).toBe('EVENT_COMPLETE');
  });
});

describe('computeTeamMetrics', () => {
  it('returns zero metrics for team with no matches', () => {
    const metrics = computeTeamMetrics(9999, [], 'Unknown');
    expect(metrics.matchCount).toBe(0);
    expect(metrics.totalExpected).toBe(0);
  });

  it('computes correct metrics for a team', () => {
    const matches: Match[] = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 2, alliance: 'Blue' }], 100, 90),
      makeMatch('2', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 3, alliance: 'Blue' }], 110, 85),
      makeMatch('3', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red' }, { teamNumber: 4, alliance: 'Blue' }], 95, 88),
    ];
    const metrics = computeTeamMetrics(1, matches, 'Team One');
    expect(metrics.teamNumber).toBe(1);
    expect(metrics.matchCount).toBe(3);
    expect(metrics.totalExpected).toBeGreaterThan(0);
    expect(metrics.reliabilityIndex).toBeGreaterThanOrEqual(0);
    expect(metrics.reliabilityIndex).toBeLessThanOrEqual(100);
  });

  it('skips DQ matches', () => {
    const matches: Match[] = [
      makeMatch('1', 'QUAL', true, [{ teamNumber: 1, alliance: 'Red', dq: true }, { teamNumber: 2, alliance: 'Blue' }]),
    ];
    const metrics = computeTeamMetrics(1, matches, 'Team One');
    expect(metrics.matchCount).toBe(0);
  });
});

describe('computeSynergy', () => {
  const makeMetrics = (teamNumber: number, auto: number, teleop: number, endgame: number): TeamMetrics => ({
    teamNumber,
    teamName: `Team ${teamNumber}`,
    expectedAuto: auto,
    expectedTeleop: teleop,
    expectedEndgame: endgame,
    expectedPenalties: 0,
    totalExpected: auto + teleop + endgame,
    consistency: 10,
    reliabilityIndex: 75,
    trend: 0,
    matchCount: 5,
    scores: [auto + teleop + endgame],
  });

  it('computes synergy correctly', () => {
    const autoTeam = makeMetrics(1, 60, 20, 10);
    const teleopTeam = makeMetrics(2, 10, 70, 10);
    const synergy = computeSynergy(autoTeam, teleopTeam);
    expect(synergy.complementarity).toBeGreaterThan(0);
    expect(synergy.synergyScore).toBeGreaterThan(0);
  });

  it('penalizes overlap', () => {
    const team1 = makeMetrics(1, 30, 30, 30);
    const team2 = makeMetrics(2, 30, 30, 30);
    const synergy = computeSynergy(team1, team2);
    expect(synergy.overlapPenalty).toBeGreaterThan(0);
  });
});

describe('generatePicklist', () => {
  const makeMetrics = (teamNumber: number, total: number, reliability: number): TeamMetrics => ({
    teamNumber,
    teamName: `Team ${teamNumber}`,
    expectedAuto: total * 0.3,
    expectedTeleop: total * 0.5,
    expectedEndgame: total * 0.2,
    expectedPenalties: 0,
    totalExpected: total,
    consistency: 10,
    reliabilityIndex: reliability,
    trend: 0,
    matchCount: 5,
    scores: Array(5).fill(total),
  });

  it('returns sorted picklist', () => {
    const captain = makeMetrics(1, 100, 80);
    const candidates = [
      makeMetrics(2, 80, 60),
      makeMetrics(3, 120, 85),
      makeMetrics(4, 70, 90),
    ];
    const picklist = generatePicklist(captain, candidates, 'BALANCED');
    expect(picklist.length).toBe(3);
    expect(picklist[0].rank).toBe(1);
    for (let i = 1; i < picklist.length; i++) {
      expect(picklist[i].score).toBeLessThanOrEqual(picklist[i - 1].score);
    }
  });

  it('excludes captain from picklist', () => {
    const captain = makeMetrics(1, 100, 80);
    const candidates = [makeMetrics(1, 100, 80), makeMetrics(2, 90, 70)];
    const picklist = generatePicklist(captain, candidates, 'BALANCED');
    expect(picklist.find(p => p.teamNumber === 1)).toBeUndefined();
  });
});

describe('simulateWinProbability', () => {
  const makeMetrics = (teamNumber: number, total: number): TeamMetrics => ({
    teamNumber,
    teamName: `Team ${teamNumber}`,
    expectedAuto: total * 0.3,
    expectedTeleop: total * 0.5,
    expectedEndgame: total * 0.2,
    expectedPenalties: 0,
    totalExpected: total,
    consistency: 5,
    reliabilityIndex: 80,
    trend: 0,
    matchCount: 5,
    scores: Array(5).fill(total),
  });

  it('returns higher win prob for stronger alliance', () => {
    const strongTeam = makeMetrics(1, 200);
    const weakTeam = makeMetrics(2, 50);
    const result = simulateWinProbability([strongTeam], [weakTeam], 500);
    expect(result.winProbability).toBeGreaterThan(0.7);
    expect(result.expectedMargin).toBeGreaterThan(0);
  });

  it('returns near 50% for equal alliances', () => {
    const t1 = makeMetrics(1, 100);
    const t2 = makeMetrics(2, 100);
    const result = simulateWinProbability([t1], [t2], 1000);
    expect(result.winProbability).toBeGreaterThan(0.3);
    expect(result.winProbability).toBeLessThan(0.7);
  });

  it('handles empty alliances', () => {
    const t1 = makeMetrics(1, 100);
    const result = simulateWinProbability([t1], [], 100);
    expect(result.winProbability).toBe(1);
  });
});
