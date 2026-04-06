'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, RefreshCw, AlertTriangle, Trophy, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { PhaseIndicator } from '@/components/PhaseIndicator';
import { SparkLine } from '@/components/SparkLine';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import {
  detectEventPhase,
  computeTeamMetrics,
  computeOPR,
  computeSynergy,
  generateAlliancePitches,
  type TeamMetrics,
  type EventPhase,
  type AlliancePitch,
} from '@/lib/analytics';
import type { Team, TeamEvent, Match, Ranking } from '@/lib/ftcscout';

// ─── Scenario config ──────────────────────────────────────────────────────────

const SCENARIOS = [
  { id: 'OVERALL',   label: 'Best Overall',   icon: '⚖️', hint: 'Best fit with your team' },
  { id: 'AUTO',      label: 'Best Auto',      icon: '🤖', hint: 'Top autonomous scorers'  },
  { id: 'TELEOP',    label: 'Best TeleOp',    icon: '🕹️', hint: 'Top teleop scorers'      },
  { id: 'ENDGAME',   label: 'Best Endgame',   icon: '⬆️', hint: 'Best endgame performers' },
  { id: 'RELIABLE',  label: 'Most Reliable',  icon: '🛡️', hint: 'Consistent every match'  },
  { id: 'CEILING',   label: 'High Ceiling',   icon: '🚀', hint: 'Highest scoring upside'  },
  { id: 'PENALTIES', label: 'Low Penalties',  icon: '✅', hint: 'Fewest penalties'         },
] as const;

type ScenarioId = typeof SCENARIOS[number]['id'];

// Sort candidates by scenario
function sortByScenario(
  teams: TeamMetrics[],
  scenario: ScenarioId,
  myMetrics: TeamMetrics
): TeamMetrics[] {
  return [...teams].sort((a, b) => {
    const score = (m: TeamMetrics): number => {
      switch (scenario) {
        case 'OVERALL':   return computeSynergy(myMetrics, m).synergyScore;
        case 'AUTO':      return m.autoOpr ?? m.expectedAuto;
        case 'TELEOP':    return m.teleopOpr ?? m.expectedTeleop;
        case 'ENDGAME':   return m.endgameOpr ?? m.expectedEndgame;
        case 'RELIABLE':  return m.reliabilityIndex;
        case 'CEILING':   return m.totalExpected + Math.max(0, m.trend) * 3;
        case 'PENALTIES': return -(m.expectedPenalties);
      }
    };
    return score(b) - score(a);
  });
}

// Key metric to show large on card
function keyMetric(
  m: TeamMetrics,
  scenario: ScenarioId,
  myMetrics: TeamMetrics
): { value: string; label: string; color: string } {
  switch (scenario) {
    case 'OVERALL': {
      const syn = computeSynergy(myMetrics, m);
      return { value: syn.synergyScore.toFixed(0), label: 'synergy', color: 'text-blue-400' };
    }
    case 'AUTO':
      return { value: (m.autoOpr ?? m.expectedAuto).toFixed(0), label: 'auto pts', color: 'text-cyan-400' };
    case 'TELEOP':
      return { value: (m.teleopOpr ?? m.expectedTeleop).toFixed(0), label: 'teleop pts', color: 'text-emerald-400' };
    case 'ENDGAME':
      return { value: (m.endgameOpr ?? m.expectedEndgame).toFixed(0), label: 'endgame pts', color: 'text-purple-400' };
    case 'RELIABLE':
      return {
        value: `${m.reliabilityIndex.toFixed(0)}%`,
        label: 'reliability',
        color: m.reliabilityIndex >= 70 ? 'text-emerald-400' : 'text-amber-400',
      };
    case 'CEILING':
      return {
        value: (m.totalExpected + Math.max(0, m.trend) * 2).toFixed(0),
        label: 'ceiling est.',
        color: 'text-yellow-400',
      };
    case 'PENALTIES':
      return {
        value: m.expectedPenalties.toFixed(1),
        label: 'avg pen. pts',
        color: m.expectedPenalties < 5 ? 'text-emerald-400' : 'text-rose-400',
      };
  }
}

// 1-2 plain-English reasons why this team matches the scenario
function reasons(
  m: TeamMetrics,
  scenario: ScenarioId,
  myMetrics: TeamMetrics,
  rank: number
): string[] {
  const r: string[] = [];
  switch (scenario) {
    case 'AUTO': {
      const val = (m.autoOpr ?? m.expectedAuto).toFixed(0);
      r.push(`Averages ${val} auto pts — ranked #${rank} auto at this event`);
      if (m.reliabilityIndex >= 70) r.push('Consistent: delivers every match, not just once');
      break;
    }
    case 'TELEOP': {
      const val = (m.teleopOpr ?? m.expectedTeleop).toFixed(0);
      r.push(`Averages ${val} teleop pts per match`);
      if (m.trend > 3) r.push(`Still improving — up +${m.trend.toFixed(1)} pts vs their event avg`);
      break;
    }
    case 'ENDGAME': {
      const val = (m.endgameOpr ?? m.expectedEndgame).toFixed(0);
      const pct = m.totalExpected > 0 ? Math.round((m.expectedEndgame / m.totalExpected) * 100) : 0;
      r.push(`Averages ${val} endgame pts (${pct}% of their total score)`);
      if (m.reliabilityIndex >= 65) r.push('Reliable finisher — executes consistently');
      break;
    }
    case 'RELIABLE':
      r.push(`${m.reliabilityIndex.toFixed(0)}% reliability index — very predictable`);
      if (m.consistency < 15) r.push(`Tight score range: IQR only ${m.consistency.toFixed(0)} pts`);
      break;
    case 'CEILING':
      if (m.trend > 3) r.push(`Trending up: +${m.trend.toFixed(1)} pts vs their event avg`);
      else r.push(`High-output scorer averaging ${m.totalExpected.toFixed(0)} pts`);
      r.push(`Ceiling estimate ~${(m.totalExpected + Math.max(0, m.trend) * 2).toFixed(0)} pts per match`);
      break;
    case 'PENALTIES':
      r.push(`Only ${m.expectedPenalties.toFixed(1)} penalty pts avg — plays very clean`);
      if (m.reliabilityIndex >= 60) r.push('Reliable and consistent — low risk partner');
      break;
    case 'OVERALL': {
      const syn = computeSynergy(myMetrics, m);
      if (syn.complementarity > 20) r.push("Scoring profile complements your team's strengths");
      r.push(`Combined scoring potential: ~${(myMetrics.totalExpected + m.totalExpected).toFixed(0)} pts/match`);
      break;
    }
  }
  if (r.length === 0) r.push(`Averages ${m.totalExpected.toFixed(0)} pts per match`);
  return r.slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScenarioTeamCard({
  m,
  position,
  scenario,
  myMetrics,
  delay = 0,
}: {
  m: TeamMetrics;
  position: number;
  scenario: ScenarioId;
  myMetrics: TeamMetrics;
  delay?: number;
}) {
  const km = keyMetric(m, scenario, myMetrics);
  const whys = reasons(m, scenario, myMetrics, position);
  const trendUp = m.trend > 3;
  const trendDown = m.trend < -5;

  return (
    <div
      className="glass glass-hover rounded-xl overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Position badge */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
          <span className="text-sm font-black text-slate-300">#{position}</span>
        </div>

        {/* Team info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{m.teamName || `Team ${m.teamNumber}`}</p>
          <p className="text-[11px] text-muted-foreground">#{m.teamNumber} · {m.matchCount} match{m.matchCount !== 1 ? 'es' : ''}</p>

          {/* Badges */}
          <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
            {m.reliabilityIndex >= 70 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">🛡 Reliable</span>
            )}
            {m.reliabilityIndex < 40 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-400">⚠ High variance</span>
            )}
            {trendUp && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400">↑ Trending</span>
            )}
            {trendDown && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-400">↓ Declining</span>
            )}
            {m.matchCount < 3 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">⚠ Low data</span>
            )}
          </div>
        </div>

        {/* Key metric + sparkline */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right">
            <p className={`text-2xl font-black tabular-nums ${km.color}`}>{km.value}</p>
            <p className="text-[10px] text-muted-foreground">{km.label}</p>
          </div>
          {m.recentScores && m.recentScores.length >= 2 && (
            <SparkLine scores={m.recentScores} width={60} height={20} />
          )}
        </div>
      </div>

      {/* Reasons */}
      <div className="px-4 pb-3 space-y-1 border-t border-white/5 pt-2">
        {whys.map((w, i) => (
          <p key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
            <span className="text-blue-400 flex-shrink-0 mt-px">›</span>
            {w}
          </p>
        ))}
      </div>
    </div>
  );
}

function CaptainPitchCard({
  pitch,
  rank,
  delay = 0,
}: {
  pitch: AlliancePitch;
  rank: number;
  delay?: number;
}) {
  const [expanded, setExpanded] = useState(rank === 1);

  return (
    <div
      className="glass glass-hover rounded-xl overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header row — always visible */}
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <span className="text-sm font-black text-emerald-400">#{rank}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {pitch.captainName || `Team ${pitch.captainTeam}`}
          </p>
          <p className="text-[11px] text-muted-foreground">#{pitch.captainTeam} · Rank #{pitch.captainRank}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-lg font-black text-emerald-400 tabular-nums">{pitch.fitScore.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">fit score</p>
          </div>
          {pitch.winProbabilityIncrease > 2 && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 whitespace-nowrap">
              +{pitch.winProbabilityIncrease.toFixed(0)}% win%
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3 animate-fade-in">
          {/* Why they need you */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Why they need you</p>
            <div className="space-y-1.5">
              {pitch.whyTheyNeedYou.map((w, i) => (
                <p key={i} className="text-xs text-emerald-300 flex items-start gap-1.5">
                  <span className="flex-shrink-0 mt-px">✓</span>{w}
                </p>
              ))}
            </div>
          </div>

          {/* What to say */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">What to say to them</p>
            <div className="space-y-1.5">
              {pitch.talkingPoints.map((t, i) => (
                <p key={i} className="text-xs text-white flex items-start gap-1.5">
                  <span className="text-blue-400 flex-shrink-0 mt-px">›</span>{t}
                </p>
              ))}
            </div>
          </div>

          {/* Red flags */}
          {pitch.redFlags.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Address proactively</p>
              <div className="space-y-1">
                {pitch.redFlags.map((f, i) => (
                  <p key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                    <span className="flex-shrink-0 mt-px">⚠</span>{f}
                  </p>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/50">Confidence: {pitch.confidence.toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

type AppMode = 'mode-select' | 'picking' | 'pitching';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamNumber = parseInt(searchParams.get('team') ?? '0');
  const season = parseInt(searchParams.get('season') ?? '2025');

  const [team, setTeam] = useState<Team | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appMode, setAppMode] = useState<AppMode>('mode-select');
  const [scenario, setScenario] = useState<ScenarioId>('OVERALL');
  const [phase, setPhase] = useState<EventPhase>('QUALS_RUNNING');

  const [myMetrics, setMyMetrics] = useState<TeamMetrics | null>(null);
  const [allMetrics, setAllMetrics] = useState<TeamMetrics[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);

  // ── Load team + events ──
  useEffect(() => {
    if (!teamNumber) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/team/${teamNumber}`).then(r => r.json()),
      fetch(`/api/team/${teamNumber}/events?season=${season}`).then(r => r.json()),
    ]).then(([teamData, eventsData]) => {
      setTeam(teamData?.error ? null : teamData);
      const evList: TeamEvent[] = Array.isArray(eventsData) ? eventsData : [];
      // Sort by start date descending → most recent first
      evList.sort((a, b) => new Date(b.event.start).getTime() - new Date(a.event.start).getTime());
      setEvents(evList);
      setSelectedEvent(prev => (!prev && evList.length > 0) ? evList[0].event.code : prev);
      setLoading(false);
    }).catch(() => {
      setError('Could not load team data. Check your connection and try again.');
      setLoading(false);
    });
  }, [teamNumber, season]);

  // ── Load event data ──
  const loadEventData = useCallback(async () => {
    if (!selectedEvent) return;
    setRefreshing(true);
    try {
      const [matchesData, teamsData] = await Promise.all([
        fetch(`/api/event/${season}/${selectedEvent}/matches`).then(r => r.json()),
        fetch(`/api/event/${season}/${selectedEvent}/teams`).then(r => r.json()),
      ]);

      const matchList: Match[] = Array.isArray(matchesData) ? matchesData : [];
      const teamList = Array.isArray(teamsData) ? teamsData : [];

      setMatches(matchList);
      setPhase(detectEventPhase(matchList));

      // Rankings
      const rankList: Ranking[] = teamList
        .filter((et: { stats?: { rank?: number } }) => et.stats)
        .map((et: {
          team: { number: number; name: string };
          stats: { rank?: number; wins?: number; losses?: number; ties?: number; rp?: number; tbp?: number; qualMatchesPlayed?: number };
        }) => ({
          teamNumber: et.team.number,
          teamName: et.team.name,
          rank: et.stats?.rank ?? 999,
          wins: et.stats?.wins ?? 0,
          losses: et.stats?.losses ?? 0,
          ties: et.stats?.ties ?? 0,
          rp: et.stats?.rp,
          tbp: et.stats?.tbp,
          qualMatchesPlayed: et.stats?.qualMatchesPlayed ?? 0,
        }))
        .sort((a: Ranking, b: Ranking) => a.rank - b.rank);
      setRankings(rankList);

      // Metrics + OPR
      const metricsMap: TeamMetrics[] = teamList.map((et: { team: { number: number; name: string } }) =>
        computeTeamMetrics(et.team.number, matchList, et.team.name)
      );
      const teamNumbers = teamList.map((et: { team: { number: number } }) => et.team.number);
      const oprMap = computeOPR(teamNumbers, matchList);
      metricsMap.forEach(m => {
        const opr = oprMap.get(m.teamNumber);
        if (opr) { m.opr = opr.totalOpr; m.autoOpr = opr.autoOpr; m.teleopOpr = opr.teleopOpr; m.endgameOpr = opr.endgameOpr; }
      });
      setAllMetrics(metricsMap);

      const mine = metricsMap.find(m => m.teamNumber === teamNumber) ?? computeTeamMetrics(teamNumber, matchList, team?.name ?? '');
      const myOpr = oprMap.get(teamNumber);
      if (myOpr) { mine.opr = myOpr.totalOpr; mine.autoOpr = myOpr.autoOpr; mine.teleopOpr = myOpr.teleopOpr; mine.endgameOpr = myOpr.endgameOpr; }
      setMyMetrics(mine);
    } catch (e) { console.error(e); }
    setRefreshing(false);
  }, [selectedEvent, season, teamNumber, team]);

  useEffect(() => { loadEventData(); }, [loadEventData]);

  // ── States ──
  if (loading) return <DashboardSkeleton />;

  if (!teamNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-8 mx-4 text-center">
          <p className="text-muted-foreground mb-4">No team selected.</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-8 mx-4 max-w-sm text-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
          <p className="text-white font-semibold">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentEventName = events.find(e => e.event.code === selectedEvent)?.event.name ?? selectedEvent;
  const myRank = rankings.find(r => r.teamNumber === teamNumber);

  const candidates = myMetrics
    ? sortByScenario(
        allMetrics.filter(m => m.teamNumber !== teamNumber),
        scenario,
        myMetrics
      )
    : [];

  const pitches = myMetrics && rankings.length > 0
    ? generateAlliancePitches(myMetrics, allMetrics, rankings)
    : [];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 glass border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => appMode !== 'mode-select' ? setAppMode('mode-select') : router.push('/')}
            className="text-muted-foreground hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm truncate">
              {team ? team.name : `Team ${teamNumber}`}
              <span className="text-muted-foreground font-normal"> · #{teamNumber}</span>
            </p>

            {/* Event row with change option */}
            <button
              className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
              onClick={() => setShowEventPicker(v => !v)}
            >
              <span className="truncate max-w-[180px]">{currentEventName || 'No event'}</span>
              {events.length > 1 && (
                showEventPicker ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />
              )}
            </button>
          </div>

          <PhaseIndicator phase={phase} />

          <button
            onClick={loadEventData}
            disabled={refreshing}
            className="text-muted-foreground hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Inline event picker */}
        {showEventPicker && events.length > 0 && (
          <div className="max-w-2xl mx-auto mt-2 animate-fade-in">
            <Select value={selectedEvent} onValueChange={v => { setSelectedEvent(v); setShowEventPicker(false); }}>
              <SelectTrigger className="bg-white/6 border-white/10 text-white text-xs">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10">
                {events.map(ev => (
                  <SelectItem key={ev.event.code} value={ev.event.code} className="text-white text-xs">
                    {ev.event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── MODE SELECT ──────────────────────────────────────────────────── */}
        {appMode === 'mode-select' && (
          <div className="space-y-4 animate-fade-in-up">
            {/* My quick stats */}
            {myMetrics && (
              <div className="glass rounded-2xl p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Your stats at this event</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Avg Score',
                      value: myMetrics.totalExpected.toFixed(0),
                      sub: myMetrics.opr !== undefined ? `OPR ${myMetrics.opr.toFixed(1)}` : undefined,
                      color: 'text-blue-400',
                    },
                    {
                      label: 'Reliability',
                      value: `${myMetrics.reliabilityIndex.toFixed(0)}%`,
                      color: myMetrics.reliabilityIndex >= 70 ? 'text-emerald-400' : myMetrics.reliabilityIndex >= 40 ? 'text-amber-400' : 'text-rose-400',
                    },
                    {
                      label: 'Rank',
                      value: myRank ? `#${myRank.rank}` : '—',
                      sub: myRank ? `${myRank.wins}W ${myRank.losses}L` : undefined,
                      color: 'text-white',
                    },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
                    </div>
                  ))}
                </div>

                {myMetrics.recentScores && myMetrics.recentScores.length >= 3 && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground mb-1">Match scores (recent)</p>
                      <SparkLine scores={myMetrics.recentScores} width={160} height={28} />
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${myMetrics.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {myMetrics.trend >= 0 ? '+' : ''}{myMetrics.trend.toFixed(1)} pts
                      </p>
                      <p className="text-[10px] text-muted-foreground">trend</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedEvent && (
              <div className="glass rounded-2xl p-4 text-center">
                <p className="text-muted-foreground text-sm">No event found for this season.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try selecting a different season on the home screen.</p>
              </div>
            )}

            {selectedEvent && (
              <>
                <p className="text-center text-sm text-muted-foreground">What do you need today?</p>

                {/* BIG mode buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAppMode('picking')}
                    className="glass glass-hover rounded-2xl p-5 flex flex-col items-center gap-3 text-left group active:scale-[0.97] transition-transform duration-100"
                  >
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <Trophy className="h-6 w-6 text-yellow-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base text-center">I&apos;m Picking</p>
                      <p className="text-xs text-muted-foreground text-center mt-0.5 leading-relaxed">
                        I&apos;m a captain — show me who to pick for my alliance
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setAppMode('pitching')}
                    className="glass glass-hover rounded-2xl p-5 flex flex-col items-center gap-3 text-left group active:scale-[0.97] transition-transform duration-100"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <Users className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base text-center">Get Me Picked</p>
                      <p className="text-xs text-muted-foreground text-center mt-0.5 leading-relaxed">
                        I need to pitch myself — show me who to approach and what to say
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PICKING MODE ─────────────────────────────────────────────────── */}
        {appMode === 'picking' && myMetrics && (
          <div className="space-y-4 animate-fade-in">
            {/* Question prompt */}
            <p className="text-sm font-semibold text-white">What does your alliance need most?</p>

            {/* Scenario chips — horizontally scrollable */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setScenario(s.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 ${
                    scenario === s.id
                      ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(59,130,246,0.5)]'
                      : 'glass border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={s.hint}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Selected scenario description */}
            <p className="text-xs text-muted-foreground">
              {SCENARIOS.find(s => s.id === scenario)?.hint} — sorted best to worst
            </p>

            {/* Team list */}
            {candidates.length === 0 ? (
              <div className="glass rounded-xl p-6 text-center">
                <p className="text-muted-foreground text-sm">Not enough match data to rank teams yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.slice(0, 10).map((m, i) => (
                  <ScenarioTeamCard
                    key={m.teamNumber}
                    m={m}
                    position={i + 1}
                    scenario={scenario}
                    myMetrics={myMetrics}
                    delay={i * 40}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PITCHING MODE ─────────────────────────────────────────────────── */}
        {appMode === 'pitching' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <p className="text-sm font-semibold text-white">Top alliances to approach</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ranked by how much they need you. Tap a card for talking points.</p>
            </div>

            {pitches.length === 0 ? (
              <div className="glass rounded-xl p-6 text-center">
                <p className="text-muted-foreground text-sm">Not enough ranking data yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Check back when more qual matches have been played.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pitches.map((pitch, i) => (
                  <CaptainPitchCard key={pitch.captainTeam} pitch={pitch} rank={i + 1} delay={i * 60} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
