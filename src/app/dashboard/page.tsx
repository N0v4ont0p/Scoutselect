'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, RefreshCw, Trophy, Target, TrendingUp, GitBranch, BookOpen } from 'lucide-react';
import { TeamCard } from '@/components/TeamCard';
import { PicklistCard } from '@/components/PicklistCard';
import { PitchCard } from '@/components/PitchCard';
import { PhaseIndicator } from '@/components/PhaseIndicator';
import { MetricBars } from '@/components/MetricBars';
import { BracketView } from '@/components/BracketView';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import {
  detectEventPhase,
  computeTeamMetrics,
  generatePicklist,
  generateAlliancePitches,
  type PicklistMode,
  type TeamMetrics,
  type EventPhase,
} from '@/lib/analytics';
import type { Team, TeamEvent, Match, Ranking } from '@/lib/ftcscout';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamNumber = parseInt(searchParams.get('team') ?? '0');
  const season = parseInt(searchParams.get('season') ?? '2024');
  const eventCode = searchParams.get('event') ?? '';

  const [team, setTeam] = useState<Team | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(eventCode);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickMode, setPickMode] = useState<PicklistMode>('BALANCED');
  const [phase, setPhase] = useState<EventPhase>('QUALS_RUNNING');

  const [myMetrics, setMyMetrics] = useState<TeamMetrics | null>(null);
  const [allMetrics, setAllMetrics] = useState<TeamMetrics[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);

  // Load team and events
  useEffect(() => {
    if (!teamNumber) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/team/${teamNumber}`).then(r => r.json()),
      fetch(`/api/team/${teamNumber}/events?season=${season}`).then(r => r.json()),
    ]).then(([teamData, eventsData]) => {
      setTeam(teamData?.error ? null : teamData);
      const evList: TeamEvent[] = Array.isArray(eventsData) ? eventsData : [];
      setEvents(evList);
      if (!selectedEvent && evList.length > 0) {
        setSelectedEvent(evList[evList.length - 1].event.code);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [teamNumber, season]);

  // Load event data when event is selected
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

      // Compute rankings from event teams
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

      // Compute metrics for all teams
      const metricsMap: TeamMetrics[] = teamList.map((et: { team: { number: number; name: string } }) =>
        computeTeamMetrics(et.team.number, matchList, et.team.name)
      );
      setAllMetrics(metricsMap);

      const mine = metricsMap.find((m: TeamMetrics) => m.teamNumber === teamNumber);
      if (mine) setMyMetrics(mine);
      else setMyMetrics(computeTeamMetrics(teamNumber, matchList, team?.name ?? ''));
    } catch (e) {
      console.error(e);
    }
    setRefreshing(false);
  }, [selectedEvent, season, teamNumber, team]);

  useEffect(() => { loadEventData(); }, [loadEventData]);

  if (loading) return <DashboardSkeleton />;
  if (!teamNumber) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">No team selected.</p>
        <Button onClick={() => router.push('/')} className="mt-3">Go Home</Button>
      </div>
    );
  }

  const picklist = myMetrics
    ? generatePicklist(myMetrics, allMetrics.filter(m => m.teamNumber !== teamNumber), pickMode)
    : [];

  const pitches = myMetrics && rankings.length > 0
    ? generateAlliancePitches(myMetrics, allMetrics, rankings)
    : [];

  const currentEventName = events.find(e => e.event.code === selectedEvent)?.event.name ?? selectedEvent;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">
              {team ? `#${team.number} ${team.name}` : `Team ${teamNumber}`}
            </p>
            <p className="text-xs text-muted-foreground truncate">{currentEventName || 'Select an event'}</p>
          </div>
          {phase && <PhaseIndicator phase={phase} />}
          <button
            onClick={loadEventData}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Team + Event selectors */}
        {team && <TeamCard team={team} />}

        {events.length > 0 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1 font-medium">Event</label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events.map(ev => (
                  <SelectItem key={ev.event.code} value={ev.event.code}>
                    {ev.event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!selectedEvent && (
          <Alert>
            <AlertDescription>Select an event to view analysis.</AlertDescription>
          </Alert>
        )}

        {selectedEvent && myMetrics && (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Avg Score', value: myMetrics.totalExpected.toFixed(0) },
                { label: 'Reliability', value: `${myMetrics.reliabilityIndex.toFixed(0)}%` },
                { label: 'Matches', value: myMetrics.matchCount },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="pt-3 pb-2 text-center">
                    <p className="text-xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="overview">
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="overview" className="text-xs px-1"><Trophy className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Overview</span></TabsTrigger>
                <TabsTrigger value="picking" className="text-xs px-1"><Target className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Picking</span></TabsTrigger>
                <TabsTrigger value="getting-picked" className="text-xs px-1"><TrendingUp className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Pitches</span></TabsTrigger>
                <TabsTrigger value="bracket" className="text-xs px-1"><GitBranch className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Bracket</span></TabsTrigger>
                <TabsTrigger value="methodology" className="text-xs px-1"><BookOpen className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">How</span></TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Your Performance</CardTitle></CardHeader>
                  <CardContent>
                    <MetricBars
                      auto={myMetrics.expectedAuto}
                      teleop={myMetrics.expectedTeleop}
                      endgame={myMetrics.expectedEndgame}
                    />
                    <Separator className="my-3" />
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Consistency (IQR)</p>
                        <p className="font-medium">{myMetrics.consistency.toFixed(1)} pts</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Trend</p>
                        <p className={`font-medium ${myMetrics.trend > 0 ? 'text-green-500' : myMetrics.trend < 0 ? 'text-red-500' : ''}`}>
                          {myMetrics.trend > 0 ? '+' : ''}{myMetrics.trend.toFixed(1)} pts
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {rankings.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Event Rankings</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {rankings.slice(0, 10).map(r => (
                        <div key={r.teamNumber} className={`flex items-center justify-between py-1 px-2 rounded ${r.teamNumber === teamNumber ? 'bg-primary/10' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-5">#{r.rank}</span>
                            <span className={`text-sm ${r.teamNumber === teamNumber ? 'font-bold text-primary' : ''}`}>
                              {r.teamName || r.teamNumber}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{r.wins}-{r.losses}-{r.ties}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="picking" className="space-y-4 mt-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Pick Mode:</label>
                  <Select value={pickMode} onValueChange={v => setPickMode(v as PicklistMode)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAFE">🛡️ Safe – Reliability first</SelectItem>
                      <SelectItem value="BALANCED">⚖️ Balanced – Best overall</SelectItem>
                      <SelectItem value="CEILING">🚀 Ceiling – Max upside</SelectItem>
                      <SelectItem value="COUNTER">🎯 Counter – Fill gaps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {picklist.length === 0 ? (
                  <Alert><AlertDescription>Not enough data to generate picklist.</AlertDescription></Alert>
                ) : (
                  <div className="space-y-3">
                    {picklist.slice(0, 8).map((pick, i) => (
                      <PicklistCard key={pick.teamNumber} pick={pick} position={i + 1} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="getting-picked" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Personalized pitches for each potential captain alliance based on your performance data.
                </p>
                {pitches.length === 0 ? (
                  <Alert><AlertDescription>Not enough ranking data to generate pitches.</AlertDescription></Alert>
                ) : (
                  <div className="space-y-3">
                    {pitches.map((pitch, i) => (
                      <PitchCard key={pitch.captainTeam} pitch={pitch} rank={i + 1} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bracket" className="space-y-4 mt-4">
                <BracketView matches={matches} />
              </TabsContent>

              <TabsContent value="methodology" className="space-y-4 mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">How ScoutSelect Works</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground mb-1">Expected Scores</p>
                      <p>Bayesian shrinkage toward event median for teams with fewer than 5 matches. This prevents small samples from distorting rankings.</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium text-foreground mb-1">Reliability Index</p>
                      <p>100 - (coefficient of variation × 100). Higher = more consistent. Clamped 0–100.</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium text-foreground mb-1">Pick Modes</p>
                      <ul className="space-y-1">
                        <li><strong>Safe:</strong> Weights reliability 50%, score 30%, synergy 20%</li>
                        <li><strong>Balanced:</strong> Weights score 40%, synergy 35%, reliability 25%</li>
                        <li><strong>Ceiling:</strong> Weights score 60%, trend 20%, synergy 20%</li>
                        <li><strong>Counter:</strong> Weights auto 50%, endgame 30%, total 20%</li>
                      </ul>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium text-foreground mb-1">Monte Carlo Simulation</p>
                      <p>1,000 simulations sampling from each team&apos;s score distribution (uniform ±1 stddev around mean) to compute win probability and upset risk.</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium text-foreground mb-1">Synergy</p>
                      <p>Measures complementarity between auto/teleop profiles. High if teams fill different roles.</p>
                    </div>
                    <p className="text-xs">Data powered by <a href="https://ftcscout.org" className="underline" target="_blank" rel="noopener noreferrer">FTCScout.org</a></p>
                  </CardContent>
                </Card>
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
