"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Users, Zap, Target, TrendingUp, TrendingDown, Minus,
  ChevronDown, AlertTriangle, CheckCircle, Shield, Star, Eye, Flame,
  Activity, Trophy, Swords,
} from "lucide-react";
import type { FTCMatch, FTCRanking, PreviewTeam } from "@/lib/ftcscout";
import {
  buildTeamMetrics, computeOPR, detectPhase, determineRole,
  optimizePicksWithDraft, rankCaptainsToApproach,
  computeMatchups, estimateNumAlliances,
  type TeamMetrics, type EventPhase, type DraftAwarePickOption,
  type CaptainApproach, type AllianceMatchup,
} from "@/lib/analytics";
import { formatScore, seasonName, cn } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

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

const PHASE_LABELS: Record<EventPhase, string> = {
  upcoming: "Upcoming",
  quals_running: "🔴 Quals Live",
  alliance_selection: "🟡 Alliance Selection",
  playoffs_running: "🟠 Playoffs Live",
  complete: "✅ Complete",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventAnalysisContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const season = parseInt(params.season as string, 10);
  const code = (params.code as string).toUpperCase();

  // ── State ──────────────────────────────────────────────────────────────────
  const [teamInput, setTeamInput] = useState(searchParams.get("team") ?? "");
  const [submittedTeam, setSubmittedTeam] = useState<number | null>(
    searchParams.get("team") ? parseInt(searchParams.get("team")!, 10) : null
  );
  const [manualPhase, setManualPhase] = useState<EventPhase | null>(null);
  const [phaseMenuOpen, setPhaseMenuOpen] = useState(false);

  const [matches, setMatches] = useState<FTCMatch[]>([]);
  const [rankings, setRankings] = useState<FTCRanking[]>([]);
  const [eventName, setEventName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview data for upcoming events
  const [previewTeams, setPreviewTeams] = useState<PreviewTeam[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      setError(String(e));
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
          6
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
      ? computeMatchups(projectedAlliance, opponentAlliances, 2000)
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
            {seasonName(season)} · {allTeams.length} teams · {qualMatches.length} qual matches
          </p>
        </div>

        {/* Phase selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setPhaseMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {PHASE_LABELS[activePhase]}
            {manualPhase && <span style={{ color: "var(--warning)" }}>·manual</span>}
            <ChevronDown className="w-3 h-3 ml-1" style={{ color: "var(--text-muted)" }} />
          </button>
          {phaseMenuOpen && (
            <div className="absolute right-0 mt-1 w-52 rounded-xl glass z-50 py-1 shadow-xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}>
                Auto-detected: {PHASE_LABELS[detectedPhase]}
              </div>
              {(["upcoming", "quals_running", "alliance_selection", "playoffs_running", "complete"] as EventPhase[]).map((ph) => (
                <button key={ph}
                  onClick={() => { setManualPhase(ph === detectedPhase ? null : ph); setPhaseMenuOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors flex items-center justify-between",
                    (manualPhase ?? detectedPhase) === ph ? "font-bold" : ""
                  )}
                  style={{ color: "var(--text)" }}>
                  {PHASE_LABELS[ph]}
                  {ph === detectedPhase && (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>auto</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
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
          <span className="font-bold text-sm">Your Team Analysis</span>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Enter your team number to unlock personalized alliance selection guidance — who to pick, who to approach, and how to pitch yourself.
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
            placeholder="Team number (e.g. 19859)"
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <button
            onClick={handleAnalyze}
            disabled={!teamInput.trim()}
            className="px-4 py-2 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}>
            Analyze →
          </button>
        </div>
        {submittedTeam && !myRanking && qualMatches.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--warning)" }}>
            ⚠ Team {submittedTeam} not found in rankings. Check the team number.
          </p>
        )}
      </div>

      {/* Role banner + analysis (only when team found) */}
      {submittedTeam && myMetrics && myRanking && myRole && (
        <>
          <RoleBanner role={myRole} teamNumber={submittedTeam} phase={activePhase} />

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
    </div>
  );
}

// ─── Role Banner ──────────────────────────────────────────────────────────────

function RoleBanner({ role, phase }: { role: ReturnType<typeof determineRole>; teamNumber: number; phase: EventPhase }) {
  const isAlliancePhase = ["alliance_selection", "playoffs_running", "complete"].includes(phase);

  const roleConfig = {
    captain: {
      icon: <Target className="w-5 h-5" />,
      title: `You're Alliance Captain #${role.rank}`,
      subtitle: `Top ${role.numAlliances} teams pick first — you'll select ${role.numAlliances === role.rank ? "last" : "your"} 2 alliance partners`,
      grad: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.1) 100%)",
      border: "rgba(99,102,241,0.4)",
      color: "var(--accent)",
    },
    picked: {
      icon: <Star className="w-5 h-5" />,
      title: `You're in the Alliance Pool`,
      subtitle: `Rank #${role.rank} — captains will approach you. See below who needs you most.`,
      grad: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.1) 100%)",
      border: "rgba(139,92,246,0.4)",
      color: "var(--accent-2)",
    },
    borderline: {
      icon: <Zap className="w-5 h-5" />,
      title: `You're on the Bubble`,
      subtitle: `Rank #${role.rank} — you're near the captain cutoff (#${role.numAlliances}). Approach captains proactively AND prepare your own picks.`,
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
            ? `Quals are running. At this rank you'd be a ${role.role === "captain" ? "captain" : "picked team"}. See guidance below to improve your position.`
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

function AllianceBuilderSection({
  myMetrics, picks, matchups, maxOPR, season,
}: {
  myMetrics: TeamMetrics;
  picks: DraftAwarePickOption[];
  matchups: AllianceMatchup[];
  maxOPR: number;
  season: number;
}) {
  const top = picks[0];
  const backups = picks.slice(1);
  const showEg = season <= 2023;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Shield className="w-5 h-5" style={{ color: "var(--accent)" }} />
        Alliance Builder
      </h2>

      {/* My robot card */}
      <div className="glass rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Your Robot</span>
          <span className="font-black text-lg" style={{ color: "var(--accent)" }}>#{myMetrics.teamNumber}</span>
        </div>
        <MetricRow label="OPR" value={myMetrics.opr} max={maxOPR} />
        <MetricRow label="Auto avg" value={myMetrics.avgAuto} max={maxOPR / 2} />
        <MetricRow label="TeleOp avg" value={myMetrics.avgDc} max={maxOPR / 2} />
        {showEg && <MetricRow label="Endgame avg" value={myMetrics.avgEndgame} max={maxOPR / 3} />}
        <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Reliability {myMetrics.reliability.toFixed(0)}/100</span>
          <span>·</span>
          <span className="flex items-center gap-1"><TrendIcon trend={myMetrics.trend} /> {myMetrics.trend > 1 ? "Improving" : myMetrics.trend < -1 ? "Declining" : "Stable"}</span>
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
                ⭐ TOP PICK
              </span>
              <span style={{ color: top.availableForPick1 ? "var(--success)" : "var(--warning)" }}
                className="text-xs">{top.availabilityTag}</span>
            </div>
            <span className="font-black text-xl" style={{ color: "var(--accent)" }}>#{top.teamNumber}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
            {top.reasons.map((r) => (
              <span key={r} className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{r}</span>
            ))}
          </div>

          <MetricRow label="OPR" value={top.metrics.opr} max={maxOPR} />
          <MetricRow label="Auto" value={top.metrics.avgAuto} max={maxOPR / 2} />
          <MetricRow label="TeleOp" value={top.metrics.avgDc} max={maxOPR / 2} />
          {showEg && <MetricRow label="Endgame" value={top.metrics.avgEndgame} max={maxOPR / 3} />}

          {top.bestPick2 && (
            <div className="mt-3 pt-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>→ With this pick, best 2nd pick: </span>
              <span className="font-bold" style={{ color: "var(--accent)" }}>#{top.bestPick2.teamNumber}</span>
              <span style={{ color: "var(--text-muted)" }}> → Projected alliance strength: </span>
              <span className="font-mono font-bold">{top.bestPick2.allianceStrength.toFixed(1)}</span>
            </div>
          )}

          <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Alliance strength (3-team): <span className="font-mono font-bold text-white">{top.allianceStrength.toFixed(1)}</span>
            {" · "}Synergy: {top.synergy.complementarity.toFixed(0)} pts complementarity
          </div>
        </div>
      )}

      {/* Backup picks */}
      {backups.length > 0 && (
        <div className="glass rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}>Backup Picks — if top choice is gone</p>
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
            style={{ color: "var(--text-muted)" }}>Projected Win Probability vs Other Alliances</p>
          <div className="space-y-2">
            {matchups.map((m) => {
              const pct = m.winProbability * 100;
              const col = pct >= 55 ? "var(--success)" : pct >= 45 ? "var(--warning)" : "var(--danger)";
              return (
                <div key={m.opponentCaptain}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--text-muted)" }}>
                      vs Alliance led by #{m.opponentCaptain}
                      {m.strengthDelta > 0
                        ? <span style={{ color: "var(--success)" }}> (+{m.strengthDelta.toFixed(0)} str)</span>
                        : <span style={{ color: "var(--danger)" }}> ({m.strengthDelta.toFixed(0)} str)</span>}
                    </span>
                    <span className="font-bold" style={{ color: col }}>{pct.toFixed(0)}% win</span>
                  </div>
                  <Bar pct={pct} color={col} />
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
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Star className="w-5 h-5" style={{ color: "var(--accent-2)" }} />
        Pitch Strategy — Who Needs You Most
      </h2>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Captains ranked by how much your team would strengthen their alliance. Approach the highest-delta captains first.
      </p>

      {approaches.slice(0, 4).map((a, i) => (
        <div key={a.captainNumber} className="glass rounded-xl p-4 space-y-3"
          style={{ border: i === 0 ? "1px solid rgba(139,92,246,0.4)" : "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg" style={{ color: i === 0 ? "var(--accent-2)" : "var(--text)" }}>
                #{i + 1} · Captain {a.captainNumber}
              </span>
              <LikelihoodBadge level={a.pickLikelihood} />
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Alliance boost</div>
              <div className="font-bold" style={{ color: "var(--success)" }}>
                +{a.improvementDelta.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Strength comparison bar */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between" style={{ color: "var(--text-muted)" }}>
              <span>Without you: {a.allianceStrengthWithoutMe.toFixed(1)}</span>
              <span>With you: {a.allianceStrengthWithMe.toFixed(1)}</span>
            </div>
            <div className="relative h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
              <div className="h-2 rounded-full" style={{ width: `${(a.allianceStrengthWithoutMe / (maxOPR * 3)) * 100}%`, background: "var(--border)" }} />
              <div className="absolute inset-y-0 rounded-full transition-all"
                style={{ left: `${(a.allianceStrengthWithoutMe / (maxOPR * 3)) * 100}%`, width: `${(a.improvementDelta / (maxOPR * 3)) * 100}%`, background: "var(--accent-2)" }} />
            </div>
          </div>

          {/* Synergy detail */}
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Complementarity: <span className="font-semibold text-white">{a.synergyWithMe.complementarity.toFixed(0)} pts</span>
            {" · "}Overlap penalty: <span className="font-semibold" style={{ color: "var(--danger)" }}>-{a.synergyWithMe.overlapPenalty.toFixed(0)}</span>
          </div>

          {/* Pitch points */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>💬 Say this to Captain #{a.captainNumber}:</p>
            <ul className="space-y-1">
              {a.pitchPoints.map((pt) => (
                <li key={pt} className="flex items-start gap-1.5 text-sm">
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Red flags */}
          {a.redFlags.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--warning)" }}>⚠ Be aware (address these proactively):</p>
              <ul className="space-y-1">
                {a.redFlags.map((f) => (
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
  const spotsAway = myRank - numAlliances;
  const isClose = spotsAway <= 3;

  return (
    <div className="glass rounded-xl p-4 space-y-2" style={{ border: "1px solid var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        Quals Running — Improve Your Position
      </p>
      {myRank <= numAlliances ? (
        <p className="text-sm">
          <span style={{ color: "var(--success)" }}>✓ You&apos;re currently a captain seed. </span>
          Hold this rank to secure pick priority.
        </p>
      ) : (
        <p className="text-sm">
          {isClose
            ? <span style={{ color: "var(--warning)" }}>You&apos;re {spotsAway} spot{spotsAway > 1 ? "s" : ""} away from a captain seed. Push hard in remaining matches!</span>
            : <span style={{ color: "var(--text-muted)" }}>Rank #{myRank} of {totalTeams}. Captain cutoff is top {numAlliances}.</span>}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {[
          { label: "Auto avg", val: myMetrics.avgAuto.toFixed(1), note: myMetrics.avgAuto < 15 ? "↑ Room to grow" : "✓ Strong" },
          { label: "TeleOp avg", val: myMetrics.avgDc.toFixed(1), note: myMetrics.avgDc < 30 ? "↑ Room to grow" : "✓ Strong" },
          { label: "Endgame avg", val: myMetrics.avgEndgame.toFixed(1), note: myMetrics.avgEndgame < 10 ? "↑ Room to grow" : "✓ Strong" },
          { label: "Consistency", val: `${myMetrics.consistency.toFixed(0)}/100`, note: myMetrics.consistency < 70 ? "↑ Reduce variance" : "✓ Consistent" },
          { label: "Reliability", val: `${myMetrics.reliability.toFixed(0)}/100`, note: "" },
          { label: "Trend", val: myMetrics.trend > 1 ? "↑ Improving" : myMetrics.trend < -1 ? "↓ Declining" : "→ Stable", note: "" },
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
  return (
    <div className="glass rounded-xl p-4 space-y-2" style={{ border: "1px solid var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
        Playoffs — Win Probability Breakdown
      </p>
      {matchups.map((m) => {
        const pct = m.winProbability * 100;
        const col = pct >= 55 ? "var(--success)" : pct >= 45 ? "var(--warning)" : "var(--danger)";
        return (
          <div key={m.opponentCaptain}>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: "var(--text-muted)" }}>vs #{m.opponentCaptain}&apos;s alliance</span>
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
    { key: "opr", label: "OPR" }, { key: "auto", label: "Auto" },
    { key: "dc", label: "TeleOp" },
    ...(showEg ? [{ key: "endgame" as SortKey, label: "EG" }] : []),
    { key: "reliability", label: "Rely" }, { key: "consistency", label: "Cons" },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5" style={{ color: "var(--accent)" }} />
          Field Strength Overview
        </h2>
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Sort:</span>
          <select className="text-xs px-2 py-1 rounded-lg"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
            value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            {cols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        All metrics are derived analytics (OPR, averages, consistency) — not raw match results.
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
              <th className="text-right px-3 py-2.5">Trend</th>
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
                          style={{ background: "rgba(99,102,241,0.2)", color: "var(--accent)" }}>C</span>
                      )}
                      <Link href={`/teams/${m.teamNumber}`}
                        className="font-bold hover:underline"
                        style={{ color: isMine ? "var(--accent)" : "var(--text)" }}>
                        {m.teamNumber}
                      </Link>
                      {isMine && <span className="text-[10px]" style={{ color: "var(--accent)" }}>◀ you</span>}
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

const TIER_CONFIG: Record<ThreatTier, { label: string; color: string; bg: string; border: string; icon: string }> = {
  elite:   { label: "🔥 Elite",   color: "#ef4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.35)",   icon: "🔥" },
  strong:  { label: "⚡ Strong",  color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.35)",  icon: "⚡" },
  solid:   { label: "📊 Solid",   color: "#6366f1", bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.25)",  icon: "📊" },
  unknown: { label: "❓ Unknown", color: "#64748b", bg: "var(--surface-2)",        border: "var(--border)",           icon: "❓" },
};

function UpcomingPreviewSection({
  teams, loading, myTeam, season, eventName,
}: {
  teams: PreviewTeam[];
  loading: boolean;
  myTeam?: number;
  season: number;
  eventName: string;
}) {
  const [tab, setTab] = useState<"threats" | "table">("threats");

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
          Pre-Event Scout Report
        </h2>
        <span className="text-xs px-2 py-1 rounded-full font-semibold"
          style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.25)" }}>
          {seasonName(season)} · {teams.length} teams registered
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
        {([["threats", "🎯 Threats Radar"], ["table", "📊 Full Roster"]] as const).map(([key, label]) => (
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
            No registered teams found yet — check back closer to the event date.
          </p>
        </div>
      ) : tab === "threats" ? (
        <div className="space-y-4">
          {/* Summary stats row — 4 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Registered",  value: teams.length,                                          icon: <Users className="w-4 h-4" /> },
              { label: "Top Score",   value: topScore > 1 ? topScore : "—",                        icon: <Trophy className="w-4 h-4" /> },
              { label: "Field Avg",   value: fieldAvgScore > 0 ? Math.round(fieldAvgScore) : "—",  icon: <Activity className="w-4 h-4" /> },
              { label: "Elite Threats", value: elites.length,                                       icon: <Flame className="w-4 h-4" /> },
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
              style={{ background: TIER_CONFIG[myTier].bg, border: `1px solid ${TIER_CONFIG[myTier].border}` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>Your Team</div>
                  <div className="font-black text-base" style={{ color: TIER_CONFIG[myTier].color }}>
                    #{myEntry.teamNumber} · {myEntry.name}
                  </div>
                  {myEntry.matchesPlayed > 0 ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{myEntry.wins}W-{myEntry.losses}L{myEntry.ties > 0 ? `-${myEntry.ties}T` : ""}</span>
                      <span>·</span>
                      <span>{(myEntry.winRate * 100).toFixed(0)}% win rate</span>
                      {myEntry.avgScore > 0 && <><span>·</span><span>Avg {myEntry.avgScore.toFixed(0)} pts</span></>}
                      {myEntry.highScore > 0 && <><span>·</span><span>Peak {myEntry.highScore}</span></>}
                      {myEntry.eventsPlayed > 0 && <><span>·</span><span>{myEntry.eventsPlayed} event{myEntry.eventsPlayed !== 1 ? "s" : ""}</span></>}
                    </div>
                  ) : (
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>No season data yet — this will be your first event</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs px-2 py-0.5 rounded-full font-bold mb-1"
                    style={{ background: TIER_CONFIG[myTier].bg, color: TIER_CONFIG[myTier].color, border: `1px solid ${TIER_CONFIG[myTier].border}` }}>
                    {TIER_CONFIG[myTier].label}
                  </div>
                  {myEntry.matchesPlayed > 0 && (
                    <>
                      <div className="text-xs font-black" style={{ color: TIER_CONFIG[myTier].color }}>
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
                    { label: "Win Rate", pct: myEntry.winRate * 100, refPct: fieldAvgWinRate * 100, color: TIER_CONFIG[myTier].color },
                    { label: "Avg Score", pct: topAvg > 1 ? (myEntry.avgScore / topAvg) * 100 : 0, refPct: topAvg > 1 ? (fieldAvgScore / topAvg) * 100 : 0, color: "var(--accent-2)" },
                    { label: "Peak Score", pct: topScore > 1 ? (myEntry.highScore / topScore) * 100 : 0, refPct: 0, color: "var(--accent)" },
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
                    White marker = field average
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Key threats */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"
              style={{ color: "var(--text-muted)" }}>
              <Swords className="w-3.5 h-3.5" /> Teams to Watch Out For
            </p>
            <div className="space-y-2.5">
              {threats.map((team, i) => {
                const tier = threatTier(team, topScore, topAvg);
                const cfg = TIER_CONFIG[tier];
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
                            <span>Avg: <span className="font-mono font-bold" style={{ color: aboveAvg ? "var(--warning)" : "inherit" }}>{team.avgScore.toFixed(0)}</span></span>
                          </>}
                          {team.highScore > 0 && <>
                            <span>·</span>
                            <span>Peak: <span className="font-mono font-bold text-white">{team.highScore}</span></span>
                          </>}
                          {team.eventsPlayed > 0 && <>
                            <span>·</span>
                            <span>{team.eventsPlayed} evt{team.eventsPlayed > 1 ? "s" : ""}</span>
                          </>}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>No season data yet — fresh team or first event</span>
                      )}
                    </div>
                    {/* Composite strength bars */}
                    {team.matchesPlayed > 0 && (
                      <div className="w-28 shrink-0 space-y-1.5">
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                            <span>Strength</span>
                            <span className="font-mono font-bold" style={{ color: cfg.color }}>{score}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                            <div className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: `${score}%`, background: cfg.color }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                            <span>Win%</span>
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
                              <span>Avg</span>
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
              <p className="text-xs font-bold" style={{ color: "#ef4444" }}>⚠ Scouting Alerts</p>
              {elites.slice(0, 3).map((t) => {
                const s = strengthScore(t, topScore, topAvg);
                const avgAbove = t.avgScore > 0 && fieldAvgScore > 0
                  ? ((t.avgScore - fieldAvgScore) / fieldAvgScore * 100).toFixed(0)
                  : null;
                return (
                  <p key={t.teamNumber} className="text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="font-semibold text-white">#{t.teamNumber}</span>
                    {" "}— Strength <span className="font-bold text-white">{s}/100</span>
                    {" · "}{t.wins}W/{t.losses}L ({(t.winRate * 100).toFixed(0)}% WR)
                    {t.avgScore > 0 && <>, avg <span className="font-mono text-white">{t.avgScore.toFixed(0)}</span> pts
                      {avgAbove && parseInt(avgAbove) > 0 && <span style={{ color: "#ef4444" }}> (+{avgAbove}% above field)</span>}
                    </>}
                    {t.highScore > 0 && <>, peaked at <span className="font-mono text-white">{t.highScore}</span></>}.
                  </p>
                );
              })}
            </div>
          )}

          {/* Field strength distribution */}
          {activeTeams.length > 0 && (
            <div className="glass rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                Field Strength Distribution
              </p>
              <div className="space-y-2">
                {(["elite", "strong", "solid", "unknown"] as ThreatTier[]).map((tier) => {
                  const count = teams.filter((t) => threatTier(t, topScore, topAvg) === tier).length;
                  const pct = (count / Math.max(teams.length, 1)) * 100;
                  const cfg = TIER_CONFIG[tier];
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
                  <span style={{ color: "var(--text-muted)" }}>Field Avg Score </span>
                  <span className="font-mono font-bold">{fieldAvgScore.toFixed(0)}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Field Avg Win% </span>
                  <span className="font-mono font-bold">{(fieldAvgWinRate * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Top Score </span>
                  <span className="font-mono font-bold">{topScore > 1 ? topScore : "—"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Teams with data </span>
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
                <th className="text-right px-3 py-2.5">Tier</th>
                <th className="text-right px-3 py-2.5">W-L</th>
                <th className="text-right px-3 py-2.5">Win%</th>
                <th className="text-right px-3 py-2.5">Avg</th>
                <th className="text-right px-3 py-2.5">Peak</th>
                <th className="text-right px-3 py-2.5">Evts</th>
                <th className="text-right px-3 py-2.5">Str.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((team, i) => {
                const tier = threatTier(team, topScore, topAvg);
                const cfg = TIER_CONFIG[tier];
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
                        {isMe && <span className="text-[10px]" style={{ color: "var(--accent)" }}>◀ you</span>}
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
        ⚡ Stats from completed events this season — preview only. Live analysis available once matches begin.
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
