"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Users, Zap, Target, TrendingUp, TrendingDown, Minus,
  ChevronDown, AlertTriangle, CheckCircle, Shield, Star, Eye, Flame,
  Activity, Trophy, Swords, Printer,
} from "lucide-react";
import type { FTCMatch, FTCRanking, PreviewTeam } from "@/lib/ftcscout";
import {
  buildTeamMetrics, computeOPR, detectPhase, determineRole,
  optimizePicksWithDraft, rankCaptainsToApproach,
  computeMatchups, estimateNumAlliances,
  type TeamMetrics, type EventPhase, type DraftAwarePickOption,
  type CaptainApproach, type AllianceMatchup,
  type MonteCarloScenario, type CaptainArchetype,
} from "@/lib/analytics";
import { formatScore, seasonName, cn } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";
import { TrustBadge } from "@/components/TrustBadge";
import { AllianceBoardExport } from "@/components/AllianceBoardExport";
import {
  getEventSettings, setEventSettings,
} from "@/lib/localStorage";

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function Sparkline({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const w = 64, h = 22;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Bar({ pct, color = "var(--accent)" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
      <div className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 1) return <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />;
  if (trend < -1) return <TrendingDown className="w-3.5 h-3.5" style={{ color: "var(--danger)" }} />;
  return <Minus className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />;
}

function LikelihoodBadge({ level }: { level: "high" | "medium" | "low" }) {
  const map = {
    high: { label: "HIGH", color: "var(--success)", bg: "rgba(34,197,94,0.12)" },
    medium: { label: "MED", color: "var(--warning)", bg: "rgba(245,158,11,0.12)" },
    low: { label: "LOW", color: "var(--text-muted)", bg: "var(--surface-2)" },
  };
  const { label, color, bg } = map[level];
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider"
      style={{ color, background: bg }}>
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventAnalysisContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const season = parseInt(params.season as string, 10);
  const code = (params.code as string).toUpperCase();
  const { t } = useI18n();
  const a = t.analysis;

  const phaseLabels: Record<EventPhase, string> = {
    upcoming: a.phases.upcoming,
    quals_running: a.phases.quals_running,
    alliance_selection: a.phases.alliance_selection,
    playoffs_running: a.phases.playoffs_running,
    complete: a.phases.complete,
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [teamInput, setTeamInput] = useState(searchParams.get("team") ?? "");
  const [submittedTeam, setSubmittedTeam] = useState<number | null>(
    searchParams.get("team") ? parseInt(searchParams.get("team")!, 10) : null
  );
  const [manualPhase, setManualPhase] = useState<EventPhase | null>(null);
  const [phaseMenuOpen, setPhaseMenuOpen] = useState(false);

  // Monte Carlo scenario + captain archetype (persisted per event)
  const [scenario, setScenario] = useState<MonteCarloScenario>("nominal");
  const [archetype, setArchetype] = useState<CaptainArchetype>("balanced");
  const [showExport, setShowExport] = useState(false);

  const [matches, setMatches] = useState<FTCMatch[]>([]);
  const [rankings, setRankings] = useState<FTCRanking[]>([]);
  const [eventName, setEventName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview data for upcoming events
  const [previewTeams, setPreviewTeams] = useState<PreviewTeam[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load persisted scenario + archetype for this event
  useEffect(() => {
    const saved = getEventSettings(season, code);
    setScenario(saved.scenario);
    setArchetype(saved.archetype);
  }, [season, code]);

  // Persist when scenario/archetype changes
  useEffect(() => {
    setEventSettings(season, code, { scenario, archetype });
  }, [season, code, scenario, archetype]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchRes, teamsRes, evRes] = await Promise.all([
        fetch(`/api/event/${season}/${code}/matches`),
        fetch(`/api/event/${season}/${code}/teams`),
        fetch(`/api/event/${season}/${code}`),
      ]);
      const [matchData, teamsData, evData] = await Promise.all([
        matchRes.json(), teamsRes.json(), evRes.json(),
      ]);
      if (!matchRes.ok) throw new Error(matchData.error ?? "Failed to load matches");
      if (Array.isArray(matchData)) setMatches(matchData);
      if (teamsData?.rankings) setRankings(teamsData.rankings);
      if (evData?.name) setEventName(evData.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load event data. Please try again.");
    }
    setLoading(false);
  }, [season, code]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch preview data when event is upcoming and data is loaded
  useEffect(() => {
    if (loading) return;
    const phase = manualPhase ?? detectPhase(matches.length, matches.filter(m => m.tournamentLevel === "Quals").length, matches.filter(m => m.tournamentLevel !== "Quals").length);
    if (phase !== "upcoming") return;
    setPreviewLoading(true);
    fetch(`/api/event/${season}/${code}/preview`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPreviewTeams(d); })
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
  }, [loading, matches, manualPhase, season, code]);

  // ── Derived analytics ──────────────────────────────────────────────────────
  const qualMatches = matches.filter((m) => m.tournamentLevel === "Quals");
  const playoffMatches = matches.filter((m) => m.tournamentLevel !== "Quals");
  const detectedPhase = detectPhase(matches.length, qualMatches.length, playoffMatches.length);
  const activePhase = manualPhase ?? detectedPhase;

  const allTeams = Array.from(
    new Set(matches.flatMap((m) => [...m.redTeams, ...m.blueTeams]))
  );
  const allScores = qualMatches.flatMap((m) => [m.redScore ?? 0, m.blueScore ?? 0]).filter(Boolean);
  const eventMedian = allScores.length
    ? [...allScores].sort((a, b) => a - b)[Math.floor(allScores.length / 2)]
    : 80;

  const oprMap = computeOPR(matches, allTeams);
  const metricsMap = new Map(
    allTeams.map((t) => {
      const m = buildTeamMetrics(t, matches, eventMedian);
      m.opr = oprMap.get(t) ?? m.avgTotal;
      return [t, m];
    })
  );

  const allMetrics = Array.from(metricsMap.values()).sort((a, b) => b.opr - a.opr);
  const maxOPR = Math.max(...allMetrics.map((m) => m.opr), 1);

  // ── My team's analysis ────────────────────────────────────────────────────
  const myRanking = submittedTeam ? rankings.find((r) => r.teamNumber === submittedTeam) : null;
  const myMetrics = submittedTeam ? metricsMap.get(submittedTeam) : null;
  const myRole = myRanking ? determineRole(myRanking.rank, rankings.length || allTeams.length) : null;

  const numAlliances = estimateNumAlliances(rankings.length || allTeams.length);
  const captainRankings = rankings.slice(0, numAlliances);
  const captainMetricsList = captainRankings
    .map((r) => metricsMap.get(r.teamNumber))
    .filter(Boolean) as TeamMetrics[];

  // Non-captain available pool
  const captainNums = new Set(captainMetricsList.map((m) => m.teamNumber));
  const availablePool = allMetrics.filter((m) => !captainNums.has(m.teamNumber));

  // Captain analysis
  const captainPicks: DraftAwarePickOption[] =
    myRole?.role === "captain" || myRole?.role === "borderline"
      ? optimizePicksWithDraft(
          myMetrics!,
          myRole.rank,
          captainMetricsList,
          availablePool,
          6,
          archetype
        )
      : [];

  // Picked analysis
  const pitchApproaches: CaptainApproach[] =
    (myRole?.role === "picked" || myRole?.role === "borderline") && myMetrics
      ? rankCaptainsToApproach(myMetrics, captainMetricsList, allMetrics)
      : [];

  // Matchup projections (if captain and top pick is determined)
  const projectedAlliance: TeamMetrics[] =
    myMetrics && captainPicks[0]
      ? [
          myMetrics,
          captainPicks[0].metrics,
          ...(captainPicks[0].bestPick2 ? [captainPicks[0].bestPick2.metrics] : []),
        ]
      : myMetrics
      ? [myMetrics]
      : [];

  const opponentAlliances = captainMetricsList
    .filter((c) => c.teamNumber !== submittedTeam)
    .map((c) => {
      const picks = optimizePicksWithDraft(c, captainRankings.findIndex((r) => r.teamNumber === c.teamNumber) + 1, captainMetricsList, availablePool, 3);
      return {
        captain: c.teamNumber,
        teams: [c, ...(picks[0] ? [picks[0].metrics] : []), ...(picks[0]?.bestPick2 ? [picks[0].bestPick2.metrics] : [])],
      };
    });

  const matchups: AllianceMatchup[] =
    projectedAlliance.length >= 2 && opponentAlliances.length
      ? computeMatchups(projectedAlliance, opponentAlliances, 2000, scenario)
      : [];

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleAnalyze() {
    const n = parseInt(teamInput.trim(), 10);
    if (n > 0) setSubmittedTeam(n);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-4">
        {[120, 80, 220, 160].map((w, i) => (
          <div key={i} className="shimmer rounded-xl" style={{ height: 20, width: w }} />
        ))}
        <div className="shimmer rounded-2xl" style={{ height: 120 }} />
        <div className="shimmer rounded-2xl" style={{ height: 280 }} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back + header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Link
          href={searchParams.get("team") ? `/teams/${searchParams.get("team")}` : "/events"}
          className="flex items-center gap-1.5 text-sm shrink-0"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" />
          {searchParams.get("team")
            ? t.eventAnalysis.backTeam.replace("{num}", searchParams.get("team")!)
            : t.eventAnalysis.backEvents}
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black truncate">
            {eventName || code}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {seasonName(season)} · {a.teamsCount.replace("{n}", String(allTeams.length))} · {a.qualMatchesCount.replace("{n}", String(qualMatches.length))}
          </p>
        </div>

        {/* Phase selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setPhaseMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {phaseLabels[activePhase]}
            {manualPhase && <span style={{ color: "var(--warning)" }}> · {a.manualLabel}</span>}
            <ChevronDown className="w-3 h-3 ml-1" style={{ color: "var(--text-muted)" }} />
          </button>
          {phaseMenuOpen && (
            <div className="absolute right-0 mt-1 w-52 rounded-xl glass z-50 py-1 shadow-xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}>
                {a.autoDetected} {phaseLabels[detectedPhase]}
              </div>
              {(["upcoming", "quals_running", "alliance_selection", "playoffs_running", "complete"] as EventPhase[]).map((ph) => (
                <button key={ph}
                  onClick={() => { setManualPhase(ph === detectedPhase ? null : ph); setPhaseMenuOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors flex items-center justify-between",
                    (manualPhase ?? detectedPhase) === ph ? "font-bold" : ""
                  )}
                  style={{ color: "var(--text)" }}>
                  {phaseLabels[ph]}
                  {ph === detectedPhase && (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{a.autoLabel}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export button */}
        {myMetrics && (
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <Printer className="w-3.5 h-3.5" />
            {t.export.exportBtn}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Team input */}
      <div className="glass rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: "var(--accent)" }}>
          <Target className="w-4 h-4" />
          <span className="font-bold text-sm">{a.yourTeamAnalysis}</span>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {a.teamInputDesc}
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
            placeholder={a.teamPlaceholder}
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <button
            onClick={handleAnalyze}
            disabled={!teamInput.trim()}
            className="px-4 py-2 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}>
            {a.analyzeBtn}
          </button>
        </div>
        {submittedTeam && !myRanking && qualMatches.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--warning)" }}>
            {a.teamNotFound.replace("{team}", String(submittedTeam))}
          </p>
        )}
      </div>

      {/* Role banner + analysis (only when team found) */}
      {submittedTeam && myMetrics && myRanking && myRole && (
        <>
          <RoleBanner role={myRole} teamNumber={submittedTeam} phase={activePhase} />

          {/* Scenario + archetype controls */}
          <ScenarioArchetypeBar
            scenario={scenario}
            onScenario={setScenario}
            archetype={archetype}
            onArchetype={setArchetype}
          />

          {/* Captain section */}
          {(myRole.role === "captain" || myRole.role === "borderline") && captainPicks.length > 0 && (
            <AllianceBuilderSection
              myMetrics={myMetrics}
              picks={captainPicks}
              matchups={matchups}
              maxOPR={maxOPR}
              season={season}
            />
          )}

          {/* Picked section */}
          {(myRole.role === "picked" || myRole.role === "borderline") && pitchApproaches.length > 0 && (
            <PitchStrategySection
              myMetrics={myMetrics}
              approaches={pitchApproaches}
              maxOPR={maxOPR}
            />
          )}

          {/* Quals-specific guidance */}
          {activePhase === "quals_running" && (
            <QualsGuidanceSection myMetrics={myMetrics} myRank={myRanking.rank} totalTeams={rankings.length} numAlliances={numAlliances} />
          )}

          {/* Playoff guidance */}
          {activePhase === "playoffs_running" && matchups.length > 0 && (
            <PlayoffSection matchups={matchups} />
          )}
        </>
      )}

      {/* Field overview — always visible once data is loaded */}
      {allMetrics.length > 0 && (
        <FieldOverviewSection
          metrics={allMetrics}
          maxOPR={maxOPR}
          highlightTeam={submittedTeam ?? undefined}
          captainNums={captainNums}
          season={season}
        />
      )}

      {/* Upcoming event preview — shown when no matches yet */}
      {activePhase === "upcoming" && (
        <UpcomingPreviewSection
          teams={previewTeams}
          loading={previewLoading}
          myTeam={submittedTeam ?? undefined}
          season={season}
          eventName={eventName || code}
        />
      )}

      {/* Alliance Board Export modal */}
      {showExport && myMetrics && (
        <AllianceBoardExport
          season={season}
          code={code}
          eventName={eventName || code}
          myMetrics={myMetrics}
          picks={captainPicks}
          matchups={matchups}
          allMetrics={allMetrics}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

// ─── Scenario + Archetype Control Bar ────────────────────────────────────────

function ScenarioArchetypeBar({
  scenario, onScenario, archetype, onArchetype,
}: {
  scenario: MonteCarloScenario;
  onScenario: (s: MonteCarloScenario) => void;
  archetype: CaptainArchetype;
  onArchetype: (a: CaptainArchetype) => void;
}) {
  const { t } = useI18n();
  const a = t.analysis;
  const scenarios: MonteCarloScenario[] = ["optimistic", "nominal", "pessimistic"];
  const scenarioLabels: Record<MonteCarloScenario, string> = {
    optimistic: a.mcOptimistic,
    nominal: a.mcNominal,
    pessimistic: a.mcPessimistic,
  };
  const archetypes: CaptainArchetype[] = ["balanced", "auto_heavy", "ceiling", "safe"];
  const archetypeLabels: Record<CaptainArchetype, string> = {
    balanced: a.archetypeBalanced,
    auto_heavy: a.archetypeAutoHeavy,
    ceiling: a.archetype_ceiling,
    safe: a.archetypeSafe,
  };
  const archetypeTooltips: Record<CaptainArchetype, string> = {
    balanced: a.archetypeTooltipBalanced,
    auto_heavy: a.archetypeTooltipAutoHeavy,
    ceiling: a.archetypeTooltipCeiling,
    safe: a.archetypeTooltipSafe,
  };

  return (
    <div className="glass rounded-xl px-4 py-3 flex flex-wrap gap-4 items-start"
      style={{ border: "1px solid var(--border)" }}>
      {/* MC Scenario */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{a.mcScenario}</span>
        <div className="flex gap-1">
          {scenarios.map((s) => (
            <button key={s}
              onClick={() => onScenario(s)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: scenario === s ? "var(--accent)" : "var(--surface-2)",
                color: scenario === s ? "#fff" : "var(--text-muted)",
                border: `1px solid ${scenario === s ? "var(--accent)" : "var(--border)"}`,
              }}>
              {scenarioLabels[s]}
            </button>
          ))}
        </div>
      </div>
      {/* Archetype */}
      <div className="flex items-start gap-2">
        <span className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{a.archetypeLabel}</span>
        <div className="flex gap-2 flex-wrap">
          {archetypes.map((arc) => (
            <div key={arc} className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => onArchetype(arc)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: archetype === arc ? "rgba(139,92,246,0.25)" : "var(--surface-2)",
                  color: archetype === arc ? "var(--accent-2)" : "var(--text-muted)",
                  border: `1px solid ${archetype === arc ? "rgba(139,92,246,0.5)" : "var(--border)"}`,
                }}>
                {archetypeLabels[arc]}
              </button>
              <span className="text-[10px] text-center leading-tight max-w-[90px]"
                style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                {archetypeTooltips[arc]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Role Banner ──────────────────────────────────────────────────────────────

function RoleBanner({ role, phase }: { role: ReturnType<typeof determineRole>; teamNumber: number; phase: EventPhase }) {
  const { t } = useI18n();
  const a = t.analysis;
  const isAlliancePhase = ["alliance_selection", "playoffs_running", "complete"].includes(phase);

  const roleConfig = {
    captain: {
      icon: <Target className="w-5 h-5" />,
      title: a.captainTitle.replace("{rank}", String(role.rank)),
      subtitle: a.captainSubtitle
        .replace("{n}", String(role.numAlliances))
        .replace("{picks}", role.numAlliances === role.rank ? a.captainPicksLast : a.captainPicksYour),
      grad: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.1) 100%)",
      border: "rgba(99,102,241,0.4)",
      color: "var(--accent)",
    },
    picked: {
      icon: <Star className="w-5 h-5" />,
      title: a.pickedTitle,
      subtitle: a.pickedSubtitle.replace("{rank}", String(role.rank)),
      grad: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.1) 100%)",
      border: "rgba(139,92,246,0.4)",
      color: "var(--accent-2)",
    },
    borderline: {
      icon: <Zap className="w-5 h-5" />,
      title: a.borderlineTitle,
      subtitle: a.borderlineSubtitle.replace("{rank}", String(role.rank)).replace("{cutoff}", String(role.numAlliances)),
      grad: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(239,68,68,0.08) 100%)",
      border: "rgba(245,158,11,0.4)",
      color: "var(--warning)",
    },
  };

  const cfg = roleConfig[role.role];
  if (!isAlliancePhase) {
    return (
      <div className="rounded-2xl px-5 py-4" style={{ background: cfg.grad, border: `1px solid ${cfg.border}` }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: cfg.color }}>
          {cfg.icon}
          <span className="font-bold">{cfg.title}</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {phase === "quals_running"
            ? a.qualsRunningRole.replace("{role}", role.role === "captain" ? a.roleCaptain : a.rolePicked)
            : cfg.subtitle}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: cfg.grad, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: cfg.color }}>
        {cfg.icon}
        <span className="font-bold text-lg">{cfg.title}</span>
      </div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{cfg.subtitle}</p>
    </div>
  );
}

// ─── Alliance Builder (captain) ───────────────────────────────────────────────

function RoleCoverageBars({ synergy }: { synergy: import("@/lib/analytics").SynergyResult }) {
  const { t } = useI18n();
  const a = t.analysis;
  const axes: { key: "auto" | "dc" | "endgame"; label: string; ci: number; pi: number }[] = [
    { key: "auto",     label: a.axisAuto,    ci: synergy.captainFingerprint[0], pi: synergy.pickFingerprint[0] },
    { key: "dc",       label: a.axisDc,      ci: synergy.captainFingerprint[1], pi: synergy.pickFingerprint[1] },
    { key: "endgame",  label: a.axisEndgame, ci: synergy.captainFingerprint[2], pi: synergy.pickFingerprint[2] },
  ];
  return (
    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {a.roleCoverageTitle}
        {synergy.gapFilledAxis && (
          <span className="ml-2 normal-case" style={{ color: "var(--success)" }}>
            · {a.fills.replace("{axis}", axisName(synergy.gapFilledAxis, a))}
          </span>
        )}
      </p>
      {axes.map(({ key, label, ci, pi }) => (
        <div key={key}>
          <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
            <span>{label}</span>
            <span>{(ci * 100).toFixed(0)}% / {(pi * 100).toFixed(0)}%</span>
          </div>
          <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
            <div style={{ width: `${ci * 50}%`, background: "var(--accent)", borderRadius: "999px 0 0 999px" }} />
            <div style={{ width: `${pi * 50}%`, background: "var(--accent-2)", borderRadius: "0 999px 999px 0" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function axisName(axis: "auto" | "dc" | "endgame", a: { axisAuto: string; axisDc: string; axisEndgame: string }) {
  if (axis === "auto") return a.axisAuto;
  if (axis === "dc") return a.axisDc;
  return a.axisEndgame;
}

function AllianceBuilderSection({
  myMetrics, picks, matchups, maxOPR, season,
}: {
  myMetrics: TeamMetrics;
  picks: DraftAwarePickOption[];
  matchups: AllianceMatchup[];
  maxOPR: number;
  season: number;
}) {
  const { t } = useI18n();
  const a = t.analysis;
  const top = picks[0];
  const backups = picks.slice(1);
  const showEg = season <= 2023;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Shield className="w-5 h-5" style={{ color: "var(--accent)" }} />
        {a.allianceBuilder}
      </h2>

      {/* My robot card */}
      <div className="glass rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{a.yourRobot}</span>
          <div className="flex items-center gap-2">
            <TrustBadge metrics={myMetrics} />
            <span className="font-black text-lg" style={{ color: "var(--accent)" }}>#{myMetrics.teamNumber}</span>
          </div>
        </div>
        <MetricRow label={a.opr} value={myMetrics.opr} max={maxOPR} />
        <MetricRow label={a.autoAvg} value={myMetrics.avgAuto} max={maxOPR / 2} />
        <MetricRow label={a.teleopAvg} value={myMetrics.avgDc} max={maxOPR / 2} />
        {showEg && <MetricRow label={a.endgameAvg} value={myMetrics.avgEndgame} max={maxOPR / 3} />}
        <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>{a.reliability.replace("{n}", myMetrics.reliability.toFixed(0))}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><TrendIcon trend={myMetrics.trend} /> {myMetrics.trend > 1 ? a.improving : myMetrics.trend < -1 ? a.declining : a.stable}</span>
          <span>·</span>
          <Sparkline values={myMetrics.sparkline} />
        </div>
      </div>

      {/* Top pick */}
      {top && (
        <div className="glass rounded-xl p-4" style={{ border: "1px solid rgba(99,102,241,0.35)" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(99,102,241,0.18)", color: "var(--accent)" }}>
                {a.topPick}
              </span>
              <span style={{ color: top.availableForPick1 ? "var(--success)" : "var(--warning)" }}
                className="text-xs">{top.availabilityTag}</span>
              {top.sensitivityTag !== "unknown" && (
                <span className="text-[10px]" style={{ color: top.sensitivityTag === "robust" ? "var(--success)" : "var(--warning)" }}>
                  {top.sensitivityTag === "robust" ? a.sensitivityRobust : a.sensitivityFragile}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TrustBadge metrics={top.metrics} showStd={false} />
              <span className="font-black text-xl" style={{ color: "var(--accent)" }}>#{top.teamNumber}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
            {top.reasons.map((r) => (
              <span key={r} className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{r}</span>
            ))}
          </div>

          <MetricRow label={a.opr} value={top.metrics.opr} max={maxOPR} />
          <MetricRow label={a.auto} value={top.metrics.avgAuto} max={maxOPR / 2} />
          <MetricRow label={a.teleop} value={top.metrics.avgDc} max={maxOPR / 2} />
          {showEg && <MetricRow label={a.endgame} value={top.metrics.avgEndgame} max={maxOPR / 3} />}

          {/* Role coverage bars */}
          <RoleCoverageBars synergy={top.synergy} />

          {top.bestPick2 && (
            <div className="mt-3 pt-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>{a.bestPick2Prefix} </span>
              <span className="font-bold" style={{ color: "var(--accent)" }}>#{top.bestPick2.teamNumber}</span>
              <span style={{ color: "var(--text-muted)" }}> {a.projectedStrength} </span>
              <span className="font-mono font-bold">{top.bestPick2.allianceStrength.toFixed(1)}</span>
            </div>
          )}

          <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            {a.allianceStrength} <span className="font-mono font-bold text-white">{top.allianceStrength.toFixed(1)}</span>
            {" · "}{a.synergyLabel.replace("{n}", top.synergy.complementarity.toFixed(0))}
          </div>
        </div>
      )}

      {/* Backup picks */}
      {backups.length > 0 && (
        <div className="glass rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}>{a.backupPicks}</p>
          <div className="space-y-2.5">
            {backups.map((p, i) => (
              <div key={p.teamNumber} className="flex items-center gap-3">
                <span className="text-xs w-4 shrink-0" style={{ color: "var(--text-muted)" }}>{i + 2}.</span>
                <span className="font-bold w-14 shrink-0" style={{ color: "var(--text)" }}>#{p.teamNumber}</span>
                <span className="text-xs shrink-0"
                  style={{ color: p.availableForPick1 ? "var(--success)" : p.availableForPick2 ? "var(--warning)" : "var(--danger)" }}>
                  {p.availabilityTag}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.label}</span>
                {p.sensitivityTag !== "unknown" && (
                  <span className="text-[10px] shrink-0" style={{ color: p.sensitivityTag === "robust" ? "var(--success)" : "var(--warning)" }}>
                    {p.sensitivityTag === "robust" ? a.sensitivityRobust : a.sensitivityFragile}
                  </span>
                )}
                <span className="ml-auto text-xs font-mono">{p.allianceStrength.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Win-probability matchups */}
      {matchups.length > 0 && (
        <div className="glass rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}>{a.winProbTitle}</p>
          <div className="space-y-2">
            {matchups.map((m) => {
              const pct = (m.winProbability * 100).toFixed(0);
              const ci = (m.winProbabilityCI * 100).toFixed(0);
              const numPct = m.winProbability * 100;
              const col = numPct >= 55 ? "var(--success)" : numPct >= 45 ? "var(--warning)" : "var(--danger)";
              return (
                <div key={m.opponentCaptain}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--text-muted)" }}>
                      {a.vsAlliance.replace("{captain}", String(m.opponentCaptain))}
                      {m.strengthDelta > 0
                        ? <span style={{ color: "var(--success)" }}> {a.strPos.replace("{n}", m.strengthDelta.toFixed(0))}</span>
                        : <span style={{ color: "var(--danger)" }}> {a.strNeg.replace("{n}", m.strengthDelta.toFixed(0))}</span>}
                    </span>
                    <span className="font-bold" style={{ color: col }}>
                      {a.winProbCI.replace("{win}", pct).replace("{ci}", ci)}
                    </span>
                  </div>
                  <Bar pct={numPct} color={col} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Pitch Strategy (being picked) ────────────────────────────────────────────

function PitchStrategySection({
  myMetrics, approaches, maxOPR,
}: {
  myMetrics: TeamMetrics;
  approaches: CaptainApproach[];
  maxOPR: number;
}) {
  const { t } = useI18n();
  const a = t.analysis;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Star className="w-5 h-5" style={{ color: "var(--accent-2)" }} />
        {a.pitchTitle}
      </h2>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {a.pitchDesc}
      </p>

      {approaches.slice(0, 4).map((ap, i) => (
        <div key={ap.captainNumber} className="glass rounded-xl p-4 space-y-3"
          style={{ border: i === 0 ? "1px solid rgba(139,92,246,0.4)" : "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg" style={{ color: i === 0 ? "var(--accent-2)" : "var(--text)" }}>
                {a.captainLabel.replace("{i}", String(i + 1)).replace("{n}", String(ap.captainNumber))}
              </span>
              <LikelihoodBadge level={ap.pickLikelihood} />
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{a.allianceBoost}</div>
              <div className="font-bold" style={{ color: "var(--success)" }}>
                +{ap.improvementDelta.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Strength comparison bar */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between" style={{ color: "var(--text-muted)" }}>
              <span>{a.withoutMe.replace("{n}", ap.allianceStrengthWithoutMe.toFixed(1))}</span>
              <span>{a.withMe.replace("{n}", ap.allianceStrengthWithMe.toFixed(1))}</span>
            </div>
            <div className="relative h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-2 rounded-full" style={{ width: `${(ap.allianceStrengthWithoutMe / (maxOPR * 3)) * 100}%`, background: "var(--border)" }} />
              <div className="absolute inset-y-0 rounded-full transition-all"
                style={{ left: `${(ap.allianceStrengthWithoutMe / (maxOPR * 3)) * 100}%`, width: `${(ap.improvementDelta / (maxOPR * 3)) * 100}%`, background: "var(--accent-2)" }} />
            </div>
          </div>

          {/* Synergy detail */}
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {a.complementarity.replace("{n}", ap.synergyWithMe.complementarity.toFixed(0))}
            {" · "}{a.overlapPenalty.replace("{n}", ap.synergyWithMe.overlapPenalty.toFixed(0))}
          </div>

          {/* Pitch points */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>{a.sayThis.replace("{n}", String(ap.captainNumber))}</p>
            <ul className="space-y-1">
              {ap.pitchPoints.map((pt) => (
                <li key={pt} className="flex items-start gap-1.5 text-sm">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Red flags */}
          {ap.redFlags.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--warning)" }}>{a.beAware}</p>
              <ul className="space-y-1">
                {ap.redFlags.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// ─── Quals guidance ───────────────────────────────────────────────────────────

function QualsGuidanceSection({
  myMetrics, myRank, totalTeams, numAlliances,
}: {
  myMetrics: TeamMetrics;
  myRank: number;
  totalTeams: number;
  numAlliances: number;
}) {
  const { t } = useI18n();
  const a = t.analysis;
  const spotsAway = myRank - numAlliances;
  const isClose = spotsAway <= 3;

  return (
    <div className="glass rounded-xl p-4 space-y-2" style={{ border: "1px solid var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {a.qualsTitle}
      </p>
      {myRank <= numAlliances ? (
        <p className="text-sm">
          <span style={{ color: "var(--success)" }}>{a.captainSeed} </span>
          {a.holdRank}
        </p>
      ) : (
        <p className="text-sm">
          {isClose
            ? <span style={{ color: "var(--warning)" }}>{a.spotsAway.replace("{n}", String(spotsAway)).replace("{plural}", spotsAway > 1 ? "s" : "")}</span>
            : <span style={{ color: "var(--text-muted)" }}>{a.farFromSeed.replace("{rank}", String(myRank)).replace("{total}", String(totalTeams)).replace("{cutoff}", String(numAlliances))}</span>}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {[
          { label: a.autoAvgLabel, val: myMetrics.avgAuto.toFixed(1), note: myMetrics.avgAuto < 15 ? a.roomToGrow : a.strongLabel },
          { label: a.teleopAvgLabel, val: myMetrics.avgDc.toFixed(1), note: myMetrics.avgDc < 30 ? a.roomToGrow : a.strongLabel },
          { label: a.endgameAvgLabel, val: myMetrics.avgEndgame.toFixed(1), note: myMetrics.avgEndgame < 10 ? a.roomToGrow : a.strongLabel },
          { label: a.consistencyLabel, val: `${myMetrics.consistency.toFixed(0)}/100`, note: myMetrics.consistency < 70 ? a.reduceVariance : a.consistentLabel },
          { label: a.reliabilityLabel, val: `${myMetrics.reliability.toFixed(0)}/100`, note: "" },
          { label: a.trendLabel, val: myMetrics.trend > 1 ? a.trendImproving : myMetrics.trend < -1 ? a.trendDeclining : a.trendStable, note: "" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg p-2.5" style={{ background: "var(--surface-2)" }}>
            <div style={{ color: "var(--text-muted)" }}>{item.label}</div>
            <div className="font-bold mt-0.5">{item.val}</div>
            {item.note && <div className="text-[10px] mt-0.5"
              style={{ color: item.note.startsWith("✓") ? "var(--success)" : "var(--warning)" }}>{item.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Playoff guidance ─────────────────────────────────────────────────────────

function PlayoffSection({ matchups }: { matchups: AllianceMatchup[] }) {
  const { t } = useI18n();
  const a = t.analysis;
  return (
    <div className="glass rounded-xl p-4 space-y-2" style={{ border: "1px solid var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
        {a.playoffTitle}
      </p>
      {matchups.map((m) => {
        const pct = m.winProbability * 100;
        const col = pct >= 55 ? "var(--success)" : pct >= 45 ? "var(--warning)" : "var(--danger)";
        return (
          <div key={m.opponentCaptain}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: "var(--text-muted)" }}>{a.vsOpponent.replace("{n}", String(m.opponentCaptain))}</span>
              <span className="font-bold" style={{ color: col }}>{pct.toFixed(0)}%</span>
            </div>
            <Bar pct={pct} color={col} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Field Overview ────────────────────────────────────────────────────────────

function FieldOverviewSection({
  metrics, maxOPR, highlightTeam, captainNums, season,
}: {
  metrics: TeamMetrics[];
  maxOPR: number;
  highlightTeam?: number;
  captainNums: Set<number>;
  season: number;
}) {
  const { t } = useI18n();
  const a = t.analysis;
  const showEg = season <= 2023;
  type SortKey = "opr" | "auto" | "dc" | "endgame" | "reliability" | "consistency";
  const [sortKey, setSortKey] = useState<SortKey>("opr");
  const sorted = [...metrics].sort((a, b) => {
    const map: Record<SortKey, (m: TeamMetrics) => number> = {
      opr: (m) => m.opr, auto: (m) => m.avgAuto, dc: (m) => m.avgDc,
      endgame: (m) => m.avgEndgame, reliability: (m) => m.reliability,
      consistency: (m) => m.consistency,
    };
    return map[sortKey](b) - map[sortKey](a);
  });

  const cols: { key: SortKey; label: string }[] = [
    { key: "opr", label: a.colOpr }, { key: "auto", label: a.colAuto },
    { key: "dc", label: a.colTeleop },
    ...(showEg ? [{ key: "endgame" as SortKey, label: a.colEg }] : []),
    { key: "reliability", label: a.colRely }, { key: "consistency", label: a.colCons },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5" style={{ color: "var(--accent)" }} />
          {a.fieldTitle}
        </h2>
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{a.sortLabel}</span>
          <select className="text-xs px-2 py-1 rounded-lg"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
            value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {a.metricsDisclaimer}
      </p>

      <div className="glass rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <th className="text-left px-3 py-2.5 w-8">#</th>
              <th className="text-left px-3 py-2.5">Team</th>
              {cols.map((c) => (
                <th key={c.key}
                  className="text-right px-3 py-2.5 cursor-pointer hover:text-white transition-colors"
                  style={{ color: sortKey === c.key ? "var(--accent)" : "var(--text-muted)" }}
                  onClick={() => setSortKey(c.key)}>
                  {c.label}
                </th>
              ))}
              <th className="text-right px-3 py-2.5">{a.trendHeader}</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => {
              const isMine = m.teamNumber === highlightTeam;
              const isCaptain = captainNums.has(m.teamNumber);
              return (
                <tr key={m.teamNumber}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: isMine ? "rgba(99,102,241,0.08)" : undefined,
                  }}
                  className="hover:bg-white/3 transition-colors">
                  <td className="px-3 py-2.5 font-mono" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {isCaptain && (
                        <span className="text-[9px] px-1 py-0.5 rounded font-bold tracking-wider"
                          style={{ background: "rgba(99,102,241,0.2)", color: "var(--accent)" }}>{a.captainBadge}</span>
                      )}
                      <Link href={`/teams/${m.teamNumber}`}
                        className="font-bold hover:underline"
                        style={{ color: isMine ? "var(--accent)" : "var(--text)" }}>
                        {m.teamNumber}
                      </Link>
                      {isMine && <span className="text-[10px]" style={{ color: "var(--accent)" }}>{a.youMarker}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatScore(m.opr)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatScore(m.avgAuto)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatScore(m.avgDc)}</td>
                  {showEg && <td className="px-3 py-2.5 text-right font-mono">{formatScore(m.avgEndgame)}</td>}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <div className="w-12">
                        <Bar pct={(m.reliability / 100) * 100}
                          color={m.reliability > 75 ? "var(--success)" : m.reliability > 50 ? "var(--warning)" : "var(--danger)"} />
                      </div>
                      <span className="w-8 text-right font-mono">{m.reliability.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{m.consistency.toFixed(0)}</td>
                  <td className="px-3 py-2.5 text-right"><TrendIcon trend={m.trend} /></td>
                  <td className="px-3 py-2.5 pl-0 pr-2">
                    <Sparkline values={m.sparkline} color={m.teamNumber === highlightTeam ? "var(--accent)" : "var(--text-muted)"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Upcoming Event Preview ────────────────────────────────────────────────────

type ThreatTier = "elite" | "strong" | "solid" | "unknown";

/**
 * Composite strength score (0–100) that weighs four dimensions:
 *  • Win rate      40 pts  — absolute competitive record
 *  • Peak score    30 pts  — relative to field high score
 *  • Avg score     20 pts  — relative to field best average
 *  • Experience    10 pts  — season events played (caps at 3)
 */
function strengthScore(team: PreviewTeam, topScore: number, topAvg: number): number {
  if (team.matchesPlayed === 0) return 0;
  const winComponent  = team.winRate * 40;
  const peakComponent = topScore > 1 ? (team.highScore / topScore) * 30 : 0;
  const avgComponent  = topAvg > 1 ? (team.avgScore / topAvg) * 20 : 0;
  const expComponent  = Math.min(team.eventsPlayed / 3, 1) * 10;
  return Math.round(winComponent + peakComponent + avgComponent + expComponent);
}

function threatTier(team: PreviewTeam, topScore: number, topAvg: number): ThreatTier {
  if (team.matchesPlayed === 0) return "unknown";
  const s = strengthScore(team, topScore, topAvg);
  if (s >= 65) return "elite";
  if (s >= 40) return "strong";
  return "solid";
}

function UpcomingPreviewSection({
  teams, loading, myTeam, season, eventName,
}: {
  teams: PreviewTeam[];
  loading: boolean;
  myTeam?: number;
  season: number;
  eventName: string;
}) {
  const { t } = useI18n();
  const a = t.analysis;
  const [tab, setTab] = useState<"threats" | "table">("threats");

  const tierConfig: Record<ThreatTier, { label: string; color: string; bg: string; border: string; icon: string }> = {
    elite:   { label: a.tierElite,   color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.35)",   icon: "🔥" },
    strong:  { label: a.tierStrong,  color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.35)",  icon: "⚡" },
    solid:   { label: a.tierSolid,   color: "#6366f1", bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.25)",  icon: "📊" },
    unknown: { label: a.tierUnknown, color: "#64748b", bg: "var(--surface-2)",        border: "var(--border)",           icon: "❓" },
  };

  const topScore = Math.max(...teams.map((t) => t.highScore), 1);
  const topAvg   = Math.max(...teams.map((t) => t.avgScore), 1);

  const activeTeams = teams.filter((t) => t.matchesPlayed > 0);
  const fieldAvgScore = activeTeams.length > 0
    ? activeTeams.reduce((s, t) => s + t.avgScore, 0) / activeTeams.length
    : 0;
  const fieldAvgWinRate = activeTeams.length > 0
    ? activeTeams.reduce((s, t) => s + t.winRate, 0) / activeTeams.length
    : 0;

  const sorted = [...teams].sort((a, b) => {
    if (a.matchesPlayed === 0 && b.matchesPlayed === 0) return 0;
    if (a.matchesPlayed === 0) return 1;
    if (b.matchesPlayed === 0) return -1;
    return strengthScore(b, topScore, topAvg) - strengthScore(a, topScore, topAvg);
  });

  const elites  = sorted.filter((t) => threatTier(t, topScore, topAvg) === "elite");
  const threats = sorted.filter((t) => t.teamNumber !== myTeam).slice(0, 6);
  const myEntry = teams.find((t) => t.teamNumber === myTeam);
  const myTier  = myEntry ? threatTier(myEntry, topScore, topAvg) : null;
  const myStrength = myEntry ? strengthScore(myEntry, topScore, topAvg) : 0;
  // Percentile: how many teams score lower than myStrength
  const myPercentile = myEntry && activeTeams.length > 0
    ? Math.round((activeTeams.filter((t) => strengthScore(t, topScore, topAvg) < myStrength).length / activeTeams.length) * 100)
    : null;

  return (
    <section className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Eye className="w-5 h-5" style={{ color: "var(--accent)" }} />
          {a.previewTitle}
        </h2>
        <span className="text-xs px-2 py-1 rounded-full font-semibold"
          style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.25)" }}>
          {seasonName(season)} · {a.teamsRegistered.replace("{n}", String(teams.length))}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
        {([["threats", a.threatsTab], ["table", a.rosterTab]] as const).map(([key, label]) => (
          <button key={key}
            onClick={() => setTab(key)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              background: tab === key ? "var(--accent)" : "transparent",
              color: tab === key ? "#fff" : "var(--text-muted)",
            }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer rounded-xl" style={{ height: 72 }} />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center" style={{ border: "1px solid var(--border)" }}>
          <Activity className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {a.noTeamsYet}
          </p>
        </div>
      ) : tab === "threats" ? (
        <div className="space-y-4">
          {/* Summary stats row — 4 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: a.registeredLabel,    value: teams.length,                                          icon: <Users className="w-4 h-4" /> },
              { label: a.topScoreLabel,      value: topScore > 1 ? topScore : "—",                        icon: <Trophy className="w-4 h-4" /> },
              { label: a.fieldAvgLabel,      value: fieldAvgScore > 0 ? Math.round(fieldAvgScore) : "—",  icon: <Activity className="w-4 h-4" /> },
              { label: a.eliteThreatsLabel,  value: elites.length,                                        icon: <Flame className="w-4 h-4" /> },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-3 text-center" style={{ border: "1px solid var(--border)" }}>
                <div className="flex justify-center mb-1" style={{ color: "var(--accent)" }}>{s.icon}</div>
                <div className="font-black text-lg">{s.value}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Your team banner */}
          {myEntry && myTier && (
            <div className="rounded-xl px-4 py-3"
              style={{ background: tierConfig[myTier].bg, border: `1px solid ${tierConfig[myTier].border}` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>{a.yourTeamLabel}</div>
                  <div className="font-black text-base" style={{ color: tierConfig[myTier].color }}>
                    #{myEntry.teamNumber} · {myEntry.name}
                  </div>
                  {myEntry.matchesPlayed > 0 ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{myEntry.wins}W-{myEntry.losses}L{myEntry.ties > 0 ? `-${myEntry.ties}T` : ""}</span>
                      <span>·</span>
                      <span>{a.winRateLabel.replace("{n}", (myEntry.winRate * 100).toFixed(0))}</span>
                      {myEntry.avgScore > 0 && <><span>·</span><span>{a.avgPts.replace("{n}", myEntry.avgScore.toFixed(0))}</span></>}
                      {myEntry.highScore > 0 && <><span>·</span><span>{a.peakLabel.replace("{n}", String(myEntry.highScore))}</span></>}
                      {myEntry.eventsPlayed > 0 && <><span>·</span><span>{a.eventsLabel.replace("{n}", String(myEntry.eventsPlayed)).replace("{plural}", myEntry.eventsPlayed !== 1 ? "s" : "")}</span></>}
                    </div>
                  ) : (
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{a.noSeasonData}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs px-2 py-0.5 rounded-full font-bold mb-1"
                    style={{ background: tierConfig[myTier].bg, color: tierConfig[myTier].color, border: `1px solid ${tierConfig[myTier].border}` }}>
                    {tierConfig[myTier].label}
                  </div>
                  {myEntry.matchesPlayed > 0 && (
                    <>
                      <div className="text-xs font-black" style={{ color: tierConfig[myTier].color }}>
                        {myStrength}<span className="font-normal text-[10px]" style={{ color: "var(--text-muted)" }}>/100</span>
                      </div>
                      {myPercentile !== null && myPercentile > 0 && (
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Top {100 - myPercentile}%
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {myEntry.matchesPlayed > 0 && (
                <div className="mt-2.5 space-y-1">
                  {[
                    { label: a.winRateHeader, pct: myEntry.winRate * 100, refPct: fieldAvgWinRate * 100, color: tierConfig[myTier].color },
                    { label: a.avgHeader, pct: topAvg > 1 ? (myEntry.avgScore / topAvg) * 100 : 0, refPct: topAvg > 1 ? (fieldAvgScore / topAvg) * 100 : 0, color: "var(--accent-2)" },
                    { label: a.peakHeader, pct: topScore > 1 ? (myEntry.highScore / topScore) * 100 : 0, refPct: 0, color: "var(--accent)" },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                        <span>{bar.label}</span>
                        <span className="font-mono">{bar.pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden relative" style={{ background: "var(--surface-2)" }}>
                        <div className="h-1.5 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(bar.pct, 100)}%`, background: bar.color }} />
                        {bar.refPct > 0 && (
                          <div className="absolute top-0 h-1.5 w-px opacity-60" style={{ left: `${Math.min(bar.refPct, 100)}%`, background: "white" }} />
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {a.whiteMarker}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Key threats */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
              style={{ color: "var(--text-muted)" }}>
              <Swords className="w-3.5 h-3.5" /> {a.teamsToWatch}
            </p>
            <div className="space-y-2.5">
              {threats.map((team, i) => {
                const tier = threatTier(team, topScore, topAvg);
                const cfg = tierConfig[tier];
                const score = strengthScore(team, topScore, topAvg);
                const winPct = team.matchesPlayed > 0 ? (team.winRate * 100).toFixed(0) : null;
                const aboveAvg = team.avgScore > fieldAvgScore;
                return (
                  <div key={team.teamNumber}
                    className="glass rounded-xl px-4 py-3 flex items-center gap-4"
                    style={{ border: `1px solid ${cfg.border}` }}>
                    {/* Rank badge */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {i + 1}
                    </div>
                    {/* Team info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link href={`/teams/${team.teamNumber}`}
                          className="font-black text-sm hover:underline"
                          style={{ color: cfg.color }}>
                          #{team.teamNumber}
                        </Link>
                        <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{team.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </div>
                      {team.matchesPlayed > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          <span>{team.wins}W-{team.losses}L{team.ties > 0 ? `-${team.ties}T` : ""}</span>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: winPct && parseInt(winPct) >= 60 ? "var(--success)" : "var(--text-muted)" }}>
                            {winPct}% WR
                          </span>
                          {team.avgScore > 0 && <>
                            <span>·</span>
                            <span>{a.avgLabel}: <span className="font-mono font-bold" style={{ color: aboveAvg ? "var(--warning)" : "inherit" }}>{team.avgScore.toFixed(0)}</span></span>
                          </>}
                          {team.highScore > 0 && <>
                            <span>·</span>
                            <span>{a.peakHeader}: <span className="font-mono font-bold text-white">{team.highScore}</span></span>
                          </>}
                          {team.eventsPlayed > 0 && <>
                            <span>·</span>
                            <span>{team.eventsPlayed} evt{team.eventsPlayed > 1 ? "s" : ""}</span>
                          </>}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{a.noSeasonDataShort}</span>
                      )}
                    </div>
                    {/* Composite strength bars */}
                    {team.matchesPlayed > 0 && (
                      <div className="w-28 shrink-0 space-y-1.5">
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                            <span>{a.strengthLabel}</span>
                            <span className="font-mono font-bold" style={{ color: cfg.color }}>{score}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                            <div className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: `${score}%`, background: cfg.color }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                            <span>{a.winPctShort}</span>
                            <span className="font-mono">{winPct}%</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                            <div className="h-1 rounded-full transition-all duration-700"
                              style={{ width: `${team.winRate * 100}%`, background: "var(--success)" }} />
                          </div>
                        </div>
                        {team.avgScore > 0 && (
                          <div>
                            <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                              <span>{a.avgLabel}</span>
                              <span className="font-mono">{team.avgScore.toFixed(0)}</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                              <div className="h-1 rounded-full transition-all duration-700"
                                style={{ width: `${topAvg > 1 ? (team.avgScore / topAvg) * 100 : 0}%`, background: "var(--accent-2)" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scouting Alerts */}
          {elites.length > 0 && (
            <div className="rounded-xl px-4 py-3 space-y-1.5"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-xs font-bold" style={{ color: "#ef4444" }}>{a.scoutingAlerts}</p>
              {elites.slice(0, 3).map((thr) => {
                const s = strengthScore(thr, topScore, topAvg);
                const avgAbove = thr.avgScore > 0 && fieldAvgScore > 0
                  ? ((thr.avgScore - fieldAvgScore) / fieldAvgScore * 100).toFixed(0)
                  : null;
                return (
                  <p key={thr.teamNumber} className="text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="font-semibold text-white">#{thr.teamNumber}</span>
                    {" "}— {a.strengthLabel} <span className="font-bold text-white">{s}/100</span>
                    {" · "}{thr.wins}W/{thr.losses}L ({(thr.winRate * 100).toFixed(0)}% WR)
                    {thr.avgScore > 0 && <>, avg <span className="font-mono text-white">{thr.avgScore.toFixed(0)}</span> pts
                      {avgAbove && parseInt(avgAbove) > 0 && <span style={{ color: "#ef4444" }}> ({a.aboveField.replace("{n}", avgAbove)})</span>}
                    </>}
                    {thr.highScore > 0 && <>, {a.peaked.replace("{n}", String(thr.highScore))}</>}.
                  </p>
                );
              })}
            </div>
          )}

          {/* Field strength distribution */}
          {activeTeams.length > 0 && (
            <div className="glass rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                {a.strengthDist}
              </p>
              <div className="space-y-2">
                {(["elite", "strong", "solid", "unknown"] as ThreatTier[]).map((tier) => {
                  const count = teams.filter((thr) => threatTier(thr, topScore, topAvg) === tier).length;
                  const pct = (count / Math.max(teams.length, 1)) * 100;
                  const cfg = tierConfig[tier];
                  return (
                    <div key={tier}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: cfg.color }}>{cfg.label}</span>
                        <span style={{ color: "var(--text-muted)" }}>{count} team{count !== 1 ? "s" : ""} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        <div className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: cfg.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 grid grid-cols-2 gap-2 text-xs" style={{ borderTop: "1px solid var(--border)" }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>{a.fieldAvgScore} </span>
                  <span className="font-mono font-bold">{fieldAvgScore.toFixed(0)}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>{a.fieldAvgWinRate} </span>
                  <span className="font-mono font-bold">{(fieldAvgWinRate * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>{a.topScoreStat} </span>
                  <span className="font-mono font-bold">{topScore > 1 ? topScore : "—"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>{a.teamsWithData} </span>
                  <span className="font-mono font-bold">{activeTeams.length}/{teams.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Full roster table */
        <div className="glass rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <th className="text-left px-3 py-2.5 w-8">#</th>
                <th className="text-left px-3 py-2.5">Team</th>
                <th className="text-right px-3 py-2.5">{a.tierHeader}</th>
                <th className="text-right px-3 py-2.5">{a.wlHeader}</th>
                <th className="text-right px-3 py-2.5">{a.winRateHeader}</th>
                <th className="text-right px-3 py-2.5">{a.avgHeader}</th>
                <th className="text-right px-3 py-2.5">{a.peakHeader}</th>
                <th className="text-right px-3 py-2.5">{a.evtsHeader}</th>
                <th className="text-right px-3 py-2.5">{a.strHeader}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((team, i) => {
                const tier = threatTier(team, topScore, topAvg);
                const cfg = tierConfig[tier];
                const score = strengthScore(team, topScore, topAvg);
                const isMe = team.teamNumber === myTeam;
                return (
                  <tr key={team.teamNumber}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: isMe ? "rgba(99,102,241,0.08)" : undefined,
                    }}
                    className="hover:bg-white/3 transition-colors">
                    <td className="px-3 py-2.5 font-mono" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/teams/${team.teamNumber}`}
                          className="font-bold hover:underline"
                          style={{ color: isMe ? "var(--accent)" : "var(--text)" }}>
                          {team.teamNumber}
                        </Link>
                        <span className="hidden sm:block text-[10px] truncate max-w-[120px]" style={{ color: "var(--text-muted)" }}>{team.name}</span>
                        {isMe && <span className="text-[10px]" style={{ color: "var(--accent)" }}>{a.youMarker}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {team.matchesPlayed > 0 ? `${team.wins}-${team.losses}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {team.matchesPlayed > 0 ? (
                        <span style={{ color: team.winRate >= 0.6 ? "var(--success)" : team.winRate >= 0.4 ? "var(--warning)" : "var(--danger)" }}>
                          {(team.winRate * 100).toFixed(0)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {team.avgScore > 0 ? (
                        <span style={{ color: team.avgScore >= fieldAvgScore ? "var(--success)" : "var(--text-muted)" }}>
                          {team.avgScore.toFixed(0)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {team.highScore > 0 ? team.highScore : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono" style={{ color: "var(--text-muted)" }}>
                      {team.eventsPlayed > 0 ? team.eventsPlayed : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {team.matchesPlayed > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                            <div className="h-1.5 rounded-full" style={{ width: `${score}%`, background: cfg.color }} />
                          </div>
                          <span className="font-mono w-6 text-right" style={{ color: cfg.color }}>{score}</span>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
        {a.previewDisclaimer}
      </p>
    </section>
  );
}



function MetricRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-xs mb-0.5">
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="font-mono">{formatScore(value)}</span>
      </div>
      <Bar pct={(value / Math.max(max, 1)) * 100} />
    </div>
  );
}
