'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, RefreshCw, Trophy, Target, TrendingUp, GitBranch, BookOpen, AlertTriangle } from 'lucide-react';
import { TeamCard } from '@/components/TeamCard';
import { PicklistCard } from '@/components/PicklistCard';
import { PitchCard } from '@/components/PitchCard';
import { PhaseIndicator } from '@/components/PhaseIndicator';
import { MetricBars } from '@/components/MetricBars';
import { BracketView } from '@/components/BracketView';
import { SparkLine } from '@/components/SparkLine';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import {
  detectEventPhase,
  computeTeamMetrics,
  computeOPR,
  generatePicklist,
  generateAlliancePitches,
  filterPicklist,
  type PicklistMode,
  type PicklistFilter,
  type TeamMetrics,
  type EventPhase,
} from '@/lib/analytics';
import type { Team, TeamEvent, Match, Ranking } from '@/lib/ftcscout';

// Pick-filter chips config
const FILTER_CHIPS: { id: PicklistFilter; label: string; icon: string }[] = [
  { id: 'ALL',              label: 'All',          icon: '🔢' },
  { id: 'AUTO_HEAVY',       label: 'Auto',         icon: '🤖' },
  { id: 'TELEOP_HEAVY',     label: 'TeleOp',       icon: '🕹' },
  { id: 'ENDGAME_HEAVY',    label: 'Endgame',      icon: '⬆' },
  { id: 'HIGH_RELIABILITY', label: 'Reliable',     icon: '🛡' },
  { id: 'HIGH_CEILING',     label: 'High ceil.',   icon: '🚀' },
  { id: 'LOW_PENALTIES',    label: 'Low pen.',     icon: '✅' },
  { id: 'TRENDING_UP',      label: 'Trending ↑',   icon: '📈' },
];

function defaultTab(phase: EventPhase): string {
  switch (phase) {
    case 'QUALS_RUNNING':
    case 'QUALS_DONE_SELECTION_PENDING':
      return 'getting-picked';
    case 'ALLIANCE_SELECTION_OR_POSTED':
    case 'PLAYOFFS_RUNNING':
      return 'picking';
    default:
      return 'overview';
  }
}

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center animate-scale-in">
      <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamNumber = parseInt(searchParams.get('team') ?? '0');
  const season = parseInt(searchParams.get('season') ?? '2025');
  const eventCode = searchParams.get('event') ?? '';

  const [team, setTeam] = useState<Team | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(eventCode);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PicklistMode>('BALANCED');
  const [pickFilter, setPickFilter] = useState<PicklistFilter>('ALL');
  const [phase, setPhase] = useState<EventPhase>('QUALS_RUNNING');
  const [activeTab, setActiveTab] = useState('overview');

  const [myMetrics, setMyMetrics] = useState<TeamMetrics | null>(null);
  const [allMetrics, setAllMetrics] = useState<TeamMetrics[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);

  // Load team and events
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
      setEvents(evList);
      setSelectedEvent(prev => (!prev && evList.length > 0) ? evList[evList.length - 1].event.code : prev);
      setLoading(false);
    }).catch(() => { setError('Failed to load team data. Check your connection.'); setLoading(false); });
  }, [teamNumber, season]);

  // Load event data
  const loadEventData = useCallback(async () => {
    if (!selectedEvent || !season) return;
    setRefreshing(true);
    try {
      const [matchesData, teamsData] = await Promise.all([
        fetch(`/api/event/${season}/${selectedEvent}/matches`).then(r => r.json()),
        fetch(`/api/event/${season}/${selectedEvent}/teams`).then(r => r.json()),
      ]);

      const matchList: Match[] = Array.isArray(matchesData) ? matchesData : [];
      const teamList = Array.isArray(teamsData) ? teamsData : [];

      setMatches(matchList);

      const detectedPhase = detectEventPhase(matchList);
      setPhase(detectedPhase);
      setActiveTab(prev => prev === 'overview' ? defaultTab(detectedPhase) : prev);

      // Rankings
      const rankList: Ranking[] = teamList
        .filter((et: { stats?: { rank?: number } }) => et.stats)
        .map((et: { team: { number: number; name: string }; stats: { rank?: number; wins?: number; losses?: number; ties?: number; rp?: number; tbp?: number; qualMatchesPlayed?: number } }) => ({
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

      // Team metrics
      const metricsMap: TeamMetrics[] = teamList.map((et: { team: { number: number; name: string } }) =>
        computeTeamMetrics(et.team.number, matchList, et.team.name)
      );

      // OPR computation
      const teamNumbers = teamList.map((et: { team: { number: number } }) => et.team.number);
      const oprMap = computeOPR(teamNumbers, matchList);
      metricsMap.forEach(m => {
        const opr = oprMap.get(m.teamNumber);
        if (opr) {
          m.opr = opr.totalOpr;
          m.autoOpr = opr.autoOpr;
          m.teleopOpr = opr.teleopOpr;
          m.endgameOpr = opr.endgameOpr;
        }
      });

      setAllMetrics(metricsMap);
      const mine = metricsMap.find(m => m.teamNumber === teamNumber) ?? computeTeamMetrics(teamNumber, matchList, team?.name ?? '');
      const myOpr = oprMap.get(teamNumber);
      if (myOpr) { mine.opr = myOpr.totalOpr; mine.autoOpr = myOpr.autoOpr; mine.teleopOpr = myOpr.teleopOpr; mine.endgameOpr = myOpr.endgameOpr; }
      setMyMetrics(mine);
    } catch (e) {
      console.error(e);
    }
    setRefreshing(false);
  }, [selectedEvent, season, teamNumber, team]);

  useEffect(() => { loadEventData(); }, [loadEventData]);

  if (loading) return <DashboardSkeleton />;

  if (!teamNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass rounded-2xl p-8 mx-4">
          <p className="text-muted-foreground mb-4">No team selected.</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center glass rounded-2xl p-8 mx-4 max-w-sm">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-2">Error loading data</p>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const rawPicklist = myMetrics
    ? generatePicklist(myMetrics, allMetrics.filter(m => m.teamNumber !== teamNumber), pickMode)
    : [];
  const picklist = filterPicklist(rawPicklist, pickFilter);

  const pitches = myMetrics && rankings.length > 0
    ? generateAlliancePitches(myMetrics, allMetrics, rankings)
    : [];

  const currentEventName = events.find(e => e.event.code === selectedEvent)?.event.name ?? selectedEvent;

  const myRank = rankings.find(r => r.teamNumber === teamNumber);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 glass border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-muted-foreground hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate text-white">
              {team ? `#${team.number} ${team.name}` : `Team ${teamNumber}`}
            </p>
            <p className="text-xs text-muted-foreground truncate">{currentEventName || 'Select an event'}</p>
          </div>
          {phase && <PhaseIndicator phase={phase} />}
          <button
            onClick={loadEventData}
            disabled={refreshing}
            className="text-muted-foreground hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Team card */}
        {team && <TeamCard team={team} />}

        {/* Event selector */}
        {events.length > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            <label className="block text-[11px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Event</label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10">
                {events.map(ev => (
                  <SelectItem key={ev.event.code} value={ev.event.code} className="text-white hover:bg-white/10">
                    {ev.event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!selectedEvent && (
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">Select an event to view analysis.</p>
          </div>
        )}

        {selectedEvent && myMetrics && (
          <>
            {/* Quick stats row */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Avg Score"
                value={myMetrics.totalExpected.toFixed(0)}
                sub={myMetrics.opr ? `OPR ${myMetrics.opr.toFixed(1)}` : undefined}
                color="text-blue-400"
              />
              <StatCard
                label="Reliability"
                value={`${myMetrics.reliabilityIndex.toFixed(0)}%`}
                color={myMetrics.reliabilityIndex >= 70 ? 'text-emerald-400' : myMetrics.reliabilityIndex >= 40 ? 'text-amber-400' : 'text-rose-400'}
              />
              <StatCard
                label="Event Rank"
                value={myRank ? `#${myRank.rank}` : '—'}
                sub={myRank ? `${myRank.wins}W-${myRank.losses}L` : undefined}
                color="text-white"
              />
            </div>

            {/* Sparkline if enough data */}
            {myMetrics.recentScores && myMetrics.recentScores.length >= 3 && (
              <div className="glass rounded-xl px-4 py-3 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Score trend (last {myMetrics.recentScores.length} matches)</p>
                  <div className="flex items-center gap-3">
                    <SparkLine scores={myMetrics.recentScores} width={120} height={36} />
                    <div className="text-right">
                      <p className={`text-sm font-bold ${myMetrics.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {myMetrics.trend >= 0 ? '+' : ''}{myMetrics.trend.toFixed(1)} pts
                      </p>
                      <p className="text-[10px] text-muted-foreground">trend</p>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <p className="text-xs font-bold tabular-nums text-white">{myMetrics.consistency.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">IQR</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold tabular-nums text-white">{(myMetrics.stddev ?? 0).toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">σ</p>
                  </div>
                </div>
              </div>
            )}

            {/* OPR breakdown if available */}
            {myMetrics.opr !== undefined && (
              <div className="glass rounded-xl px-4 py-3 animate-fade-in-up" style={{ animationDelay: '140ms' }}>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Offensive Power Rating (OPR)</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Total', value: myMetrics.opr, color: 'text-blue-400' },
                    { label: 'Auto', value: myMetrics.autoOpr, color: 'text-blue-300' },
                    { label: 'TeleOp', value: myMetrics.teleopOpr, color: 'text-emerald-400' },
                    { label: 'Endgame', value: myMetrics.endgameOpr, color: 'text-purple-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-base font-black tabular-nums ${color}`}>{(value ?? 0).toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-2">OPR computed via least-squares regression across all qual matches at this event</p>
              </div>
            )}

            {/* Main tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-5 bg-white/5 p-1 rounded-xl h-auto">
                {[
                  { id: 'overview',      Icon: Trophy,    label: 'Overview'  },
                  { id: 'picking',       Icon: Target,    label: 'Picking'   },
                  { id: 'getting-picked',Icon: TrendingUp,label: 'Pitches'   },
                  { id: 'bracket',       Icon: GitBranch, label: 'Bracket'   },
                  { id: 'methodology',   Icon: BookOpen,  label: 'How'       },
                ].map(({ id, Icon, label }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="flex flex-col items-center gap-0.5 py-2 text-[10px] data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-lg transition-all"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ─── Overview ─────────────────────────────────────────────── */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="glass rounded-xl p-4 animate-fade-in-up">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your performance</p>
                  <MetricBars
                    auto={myMetrics.expectedAuto}
                    teleop={myMetrics.expectedTeleop}
                    endgame={myMetrics.expectedEndgame}
                  />
                  <Separator className="my-3 bg-white/5" />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Consistency (IQR)</p>
                      <p className="font-bold text-white">{myMetrics.consistency.toFixed(1)} pts</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Trend</p>
                      <p className={`font-bold ${myMetrics.trend > 0 ? 'text-emerald-400' : myMetrics.trend < 0 ? 'text-rose-400' : 'text-white'}`}>
                        {myMetrics.trend > 0 ? '+' : ''}{myMetrics.trend.toFixed(1)} pts
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Std deviation</p>
                      <p className="font-bold text-white">{(myMetrics.stddev ?? 0).toFixed(1)} pts</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Penalties avg</p>
                      <p className={`font-bold ${myMetrics.expectedPenalties > 8 ? 'text-amber-400' : 'text-white'}`}>
                        {myMetrics.expectedPenalties.toFixed(1)} pts
                      </p>
                    </div>
                  </div>
                </div>

                {rankings.length > 0 && (
                  <div className="glass rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Event rankings</p>
                    <div className="space-y-1">
                      {rankings.slice(0, 10).map(r => (
                        <div
                          key={r.teamNumber}
                          className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${r.teamNumber === teamNumber ? 'bg-blue-500/15 border border-blue-500/20' : 'hover:bg-white/3'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground w-5 tabular-nums">#{r.rank}</span>
                            <span className={`text-sm ${r.teamNumber === teamNumber ? 'font-bold text-blue-300' : 'text-slate-300'}`}>
                              {r.teamName || r.teamNumber}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{r.wins}-{r.losses}-{r.ties}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ─── Picking ──────────────────────────────────────────────── */}
              <TabsContent value="picking" className="space-y-4 mt-4">
                {/* Mode + filter row */}
                <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Mode:</label>
                    <Select value={pickMode} onValueChange={v => setPickMode(v as PicklistMode)}>
                      <SelectTrigger className="h-8 bg-white/5 border-white/10 text-white text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        <SelectItem value="SAFE" className="text-white">🛡️ Safe – Reliability first</SelectItem>
                        <SelectItem value="BALANCED" className="text-white">⚖️ Balanced – Best overall</SelectItem>
                        <SelectItem value="CEILING" className="text-white">🚀 Ceiling – Max upside</SelectItem>
                        <SelectItem value="COUNTER" className="text-white">🎯 Counter – Fill gaps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Filter chips */}
                  <div className="flex gap-1.5 flex-wrap">
                    {FILTER_CHIPS.map(chip => (
                      <button
                        key={chip.id}
                        onClick={() => setPickFilter(chip.id)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-all border ${
                          pickFilter === chip.id
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {chip.icon} {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
                {picklist.length === 0 ? (
                  <div className="glass rounded-xl p-6 text-center">
                    <p className="text-muted-foreground text-sm">No picks match the current filter or not enough data.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {picklist.slice(0, 10).map((pick, i) => (
                      <PicklistCard key={pick.teamNumber} pick={pick} position={i + 1} delay={i * 60} />
                    ))}
                    {rawPicklist.length > 0 && (
                      <p className="text-[11px] text-muted-foreground text-center pt-1">
                        Showing {picklist.length} of {rawPicklist.length} teams
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* ─── Getting Picked ───────────────────────────────────────── */}
              <TabsContent value="getting-picked" className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground animate-fade-in">
                  Personalised pitches for top-ranked alliance captains, scored by synergy and win-probability increase.
                </p>
                {pitches.length === 0 ? (
                  <div className="glass rounded-xl p-6 text-center">
                    <p className="text-muted-foreground text-sm">Not enough ranking data to generate pitches yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pitches.map((pitch, i) => (
                      <PitchCard key={pitch.captainTeam} pitch={pitch} rank={i + 1} delay={i * 80} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ─── Bracket ──────────────────────────────────────────────── */}
              <TabsContent value="bracket" className="space-y-4 mt-4">
                <BracketView matches={matches} />
              </TabsContent>

              {/* ─── Methodology ──────────────────────────────────────────── */}
              <TabsContent value="methodology" className="space-y-4 mt-4">
                <div className="glass rounded-xl p-4 space-y-4 text-sm text-muted-foreground animate-fade-in">
                  <p className="text-base font-bold text-white">How ScoutSelect Works</p>

                  {[
                    {
                      title: 'OPR (Offensive Power Rating)',
                      body: 'OPR solves a least-squares system (A^T A x = A^T b) where each team's contribution is estimated from alliance scores across all played qual matches. Computed separately for auto, teleop, and endgame phases.',
                    },
                    {
                      title: 'Expected Scores + Bayesian Shrinkage',
                      body: 'For teams with fewer than 5 qual matches, observed averages are shrunk toward the event median. This prevents small samples from distorting rankings.',
                    },
                    {
                      title: 'Reliability Index',
                      body: '100 − (coefficient of variation × 100). Clamped to 0–100. Higher values mean more predictable, consistent scoring.',
                    },
                    {
                      title: 'Synergy (3-Component Fingerprint)',
                      body: 'Each team is represented by a normalised 3D vector (auto%, teleop%, endgame%). Euclidean distance between fingerprints drives complementarity; shared dominant phase creates overlap penalty.',
                    },
                    {
                      title: 'Pick Modes',
                      body: 'Safe: reliability 50%, score 30%, synergy 20%. Balanced: score 40%, synergy 35%, reliability 25%. Ceiling: score 60%, trend 20%, synergy 20%. Counter: auto 50%, endgame 30%, total 20%.',
                    },
                    {
                      title: 'Monte Carlo Simulation',
                      body: 'Each win-probability estimate runs 500–1000 simulations sampling each team score from N(μ, σ) using Box-Muller transform. Output: win%, expected margin, upset risk.',
                    },
                    {
                      title: 'Trend',
                      body: 'Exponentially-weighted mean (decay factor 0.5 per match) minus simple mean. Positive = improving; negative = declining.',
                    },
                  ].map(({ title, body }, i) => (
                    <div key={i}>
                      {i > 0 && <Separator className="bg-white/5 -mx-4" />}
                      <p className="font-semibold text-white text-sm pt-2">{title}</p>
                      <p className="text-xs leading-relaxed">{body}</p>
                    </div>
                  ))}

                  <p className="text-[11px] text-muted-foreground/50 pt-2 border-t border-white/5">
                    Data via <a href="https://ftcscout.org" className="underline" target="_blank" rel="noopener noreferrer">FTCScout.org</a> · All analytics are statistical estimates, not guarantees.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </>
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

