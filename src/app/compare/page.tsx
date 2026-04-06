"use client";
import { useState } from "react";
import { Plus, X, Home, Globe } from "lucide-react";
import Link from "next/link";
import { formatScore, getCurrentSeason } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

interface TeamMetricsSummary {
  teamNumber: number;
  avgTotal: number;
  avgAuto: number;
  avgDc: number;
  avgEndgame: number;
  opr: number;
  reliability: number;
  matchCount: number;
}

async function fetchTeamMetrics(teamNum: number, season: number, eventCode: string): Promise<TeamMetricsSummary | null> {
  try {
    const res = await fetch(`/api/event/${season}/${eventCode}/matches`);
    const matches = await res.json();
    if (!Array.isArray(matches)) return null;

    const myMatches = matches.filter(
      (m: { redTeams: number[]; blueTeams: number[]; tournamentLevel: string }) =>
        m.tournamentLevel === "Quals" &&
        (m.redTeams.includes(teamNum) || m.blueTeams.includes(teamNum))
    );

    if (!myMatches.length) return null;

    const scores = myMatches.map((m: { redTeams: number[]; redScore: number | null; blueScore: number | null }) =>
      m.redTeams.includes(teamNum) ? (m.redScore ?? 0) : (m as unknown as { blueScore: number | null }).blueScore ?? 0
    );
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

    return {
      teamNumber: teamNum,
      avgTotal: avg(scores),
      avgAuto: avg(myMatches.map((m: { autoPoints: number }) => m.autoPoints / 2)),
      avgDc: avg(myMatches.map((m: { dcPoints: number }) => m.dcPoints / 2)),
      avgEndgame: avg(myMatches.map((m: { endgamePoints: number }) => m.endgamePoints / 2)),
      opr: avg(scores),
      reliability: Math.min(100, myMatches.length * 20),
      matchCount: myMatches.length,
    };
  } catch {
    return null;
  }
}

export default function ComparePage() {
  const { t, toggle } = useI18n();
  const defaultSeason = getCurrentSeason();
  const [teamInputs, setTeamInputs] = useState<string[]>(["", ""]);
  const [season, setSeason] = useState(defaultSeason);
  const [eventCode, setEventCode] = useState("");
  const [metrics, setMetrics] = useState<(TeamMetricsSummary | null)[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleCompare() {
    if (!eventCode.trim()) return;
    setLoading(true);
    const results = await Promise.all(
      teamInputs.filter(Boolean).map((t) => fetchTeamMetrics(parseInt(t), season, eventCode.trim().toUpperCase()))
    );
    setMetrics(results);
    setLoading(false);
  }

  const maxOPR = Math.max(...metrics.filter(Boolean).map((m) => m!.opr), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <Link href="/"
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/5"
          style={{ color: "var(--text-muted)" }}>
          <Home className="w-4 h-4" />
          {t.compare.back}
        </Link>
        <button onClick={toggle} className="lang-btn flex items-center gap-1.5">
          <Globe className="w-3 h-3" />
          {t.nav.toggleLang}
        </button>
      </div>

      <h1 className="text-3xl font-black mb-8 animate-slide-up">{t.compare.title}</h1>

      <div className="glass rounded-2xl p-6 mb-8 animate-slide-up stagger-1" style={{ border: "1px solid var(--border)" }}>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest mb-1.5 block"
              style={{ color: "var(--text-muted)" }}>
              {t.compare.seasonLabel}
            </label>
            <select className="w-full px-3 py-2.5 rounded-xl text-sm cursor-pointer"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              value={season} onChange={(e) => setSeason(Number(e.target.value))}>
              {[2019,2020,2021,2022,2023,2024,2025].slice().reverse().map((s) => (
                <option key={s} value={s}>{s}–{s+1}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-widest mb-1.5 block"
              style={{ color: "var(--text-muted)" }}>
              {t.compare.eventCodeLabel}
            </label>
            <input className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              placeholder={t.compare.eventCodePlaceholder}
              value={eventCode} onChange={(e) => setEventCode(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {teamInputs.map((teamVal, i) => (
            <div key={i} className="flex gap-2">
              <input className="flex-1 px-3 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                placeholder={t.compare.teamPlaceholder.replace("{n}", String(i + 1))}
                value={teamVal} onChange={(e) => {
                  const next = [...teamInputs];
                  next[i] = e.target.value;
                  setTeamInputs(next);
                }} />
              {teamInputs.length > 2 && (
                <button onClick={() => setTeamInputs(teamInputs.filter((_, j) => j !== i))}
                  className="px-2 rounded-xl hover:bg-white/10 transition-colors"
                  style={{ color: "var(--danger)" }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {teamInputs.length < 4 && (
            <button onClick={() => setTeamInputs([...teamInputs, ""])}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-white/5"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              <Plus className="w-3 h-3" /> {t.compare.addTeam}
            </button>
          )}
          <button onClick={handleCompare} disabled={loading || !eventCode.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 hover:brightness-110"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
            {loading ? t.compare.loading : t.compare.compareBtn}
          </button>
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          {metrics.filter(Boolean).map((m) => m && (
            <div key={m.teamNumber} className="glass rounded-2xl p-5" style={{ border: "1px solid var(--border)" }}>
              <h3 className="font-bold text-lg mb-4" style={{ color: "var(--accent)" }}>
                Team {m.teamNumber}
              </h3>
              {[
                { label: t.compare.stats.opr, value: m.opr, max: maxOPR },
                { label: t.compare.stats.avgTotal, value: m.avgTotal, max: maxOPR },
                { label: t.compare.stats.auto, value: m.avgAuto, max: maxOPR / 2 },
                { label: t.compare.stats.teleop, value: m.avgDc, max: maxOPR / 2 },
                { label: t.compare.stats.endgame, value: m.avgEndgame, max: maxOPR / 2 },
              ].map((stat) => (
                <div key={stat.label} className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: "var(--text-muted)" }}>{stat.label}</span>
                    <span className="font-mono font-semibold">{formatScore(stat.value)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <div className="h-2 rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, (stat.value / stat.max) * 100)}%`,
                        background: "linear-gradient(90deg, var(--accent), var(--accent-2))"
                      }} />
                  </div>
                </div>
              ))}
              <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                {t.compare.matches.replace("{n}", String(m.matchCount))}
                {" · "}
                {t.compare.reliability.replace("{n}", m.reliability.toFixed(0))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
