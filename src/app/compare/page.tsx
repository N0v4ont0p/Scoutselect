"use client";
import { useState } from "react";
import { Plus, X, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatScore } from "@/lib/utils";

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
  const router = useRouter();
  const [teamInputs, setTeamInputs] = useState<string[]>(["", ""]);
  const [season, setSeason] = useState(2024);
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
    <div className="max-w-4xl mx-auto px-4 py-10">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-3xl font-black mb-8">Compare Teams</h1>

      <div className="glass rounded-2xl p-6 mb-8">
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: "var(--text-muted)" }}>Season</label>
            <select className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              value={season} onChange={(e) => setSeason(Number(e.target.value))}>
              {[2019,2020,2021,2022,2023,2024,2025].reverse().map((s) => (
                <option key={s} value={s}>{s}–{s+1}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: "var(--text-muted)" }}>Event Code</label>
            <input className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              placeholder="e.g. USMDCMPF1"
              value={eventCode} onChange={(e) => setEventCode(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {teamInputs.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                placeholder={`Team ${i + 1} number`}
                value={t} onChange={(e) => {
                  const next = [...teamInputs];
                  next[i] = e.target.value;
                  setTeamInputs(next);
                }} />
              {teamInputs.length > 2 && (
                <button onClick={() => setTeamInputs(teamInputs.filter((_, j) => j !== i))}
                  className="px-2 rounded-lg hover:bg-white/10" style={{ color: "var(--danger)" }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {teamInputs.length < 4 && (
            <button onClick={() => setTeamInputs([...teamInputs, ""])}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              <Plus className="w-3 h-3" /> Add Team
            </button>
          )}
          <button onClick={handleCompare} disabled={loading || !eventCode.trim()}
            className="flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#fff" }}>
            {loading ? "Loading…" : "Compare"}
          </button>
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="space-y-4">
          {metrics.filter(Boolean).map((m) => m && (
            <div key={m.teamNumber} className="glass rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4" style={{ color: "var(--accent)" }}>Team {m.teamNumber}</h3>
              {[
                { label: "OPR", value: m.opr, max: maxOPR },
                { label: "Avg Total", value: m.avgTotal, max: maxOPR },
                { label: "Auto", value: m.avgAuto, max: maxOPR / 2 },
                { label: "Teleop", value: m.avgDc, max: maxOPR / 2 },
                { label: "Endgame", value: m.avgEndgame, max: maxOPR / 2 },
              ].map((stat) => (
                <div key={stat.label} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--text-muted)" }}>{stat.label}</span>
                    <span>{formatScore(stat.value)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (stat.value / stat.max) * 100)}%`, background: "var(--accent)" }} />
                  </div>
                </div>
              ))}
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{m.matchCount} matches · Reliability {m.reliability.toFixed(0)}/100</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
