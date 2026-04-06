import { getEventMatches, getEventRankings } from "@/lib/ftcscout";
import { buildTeamMetrics, computeOPR, generatePicklist, detectPhase } from "@/lib/analytics";
import { formatScore } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ season: string; code: string }>;
}) {
  const { season: seasonStr, code } = await params;
  const season = parseInt(seasonStr, 10);

  let matches: Awaited<ReturnType<typeof getEventMatches>> = [];
  let rankings: Awaited<ReturnType<typeof getEventRankings>> = [];
  let error: string | null = null;

  try {
    [matches, rankings] = await Promise.all([
      getEventMatches(season, code),
      getEventRankings(season, code),
    ]);
  } catch (e) {
    error = String(e);
  }

  const qualMatches = matches.filter((m) => m.tournamentLevel === "Quals");
  const playoffMatches = matches.filter((m) => m.tournamentLevel !== "Quals");
  const phase = detectPhase(matches.length, qualMatches.length, playoffMatches.length);

  const allTeams = Array.from(new Set([...matches.flatMap((m) => [...m.redTeams, ...m.blueTeams])]));
  const allScores = qualMatches.flatMap((m) => [m.redScore ?? 0, m.blueScore ?? 0]).filter(Boolean);
  const eventMedian = allScores.length
    ? allScores.sort((a, b) => a - b)[Math.floor(allScores.length / 2)]
    : 80;

  const oprMap = computeOPR(matches, allTeams);
  const metricsMap = new Map(
    allTeams.map((t) => {
      const m = buildTeamMetrics(t, matches, eventMedian);
      m.opr = oprMap.get(t) ?? m.avgTotal;
      return [t, m];
    })
  );

  const phaseLabel: Record<typeof phase, string> = {
    upcoming: "Upcoming",
    quals_running: "🔴 Quals Live",
    alliance_selection: "🟡 Alliance Selection",
    playoffs_running: "🟠 Playoffs Live",
    complete: "✅ Complete",
  };

  const captainTeams = rankings.slice(0, 4).map((r) => metricsMap.get(r.teamNumber)).filter(Boolean);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/events" className="flex items-center gap-2 text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Events
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-black">{code}</h1>
        <span className="text-sm px-3 py-1 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
          {phaseLabel[phase]}
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{season}–{season + 1}</span>
      </div>

      {error && <p style={{ color: "var(--danger)" }} className="mb-4">{error}</p>}

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mb-8">
        {[
          { label: "Teams", value: allTeams.length },
          { label: "Qual Matches", value: qualMatches.length },
          { label: "Playoff Matches", value: playoffMatches.length },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rankings */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">Rankings</h2>
        <div className="glass rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <th className="text-left px-4 py-3">Rank</th>
                <th className="text-left px-4 py-3">Team</th>
                <th className="text-right px-4 py-3">W-L-T</th>
                <th className="text-right px-4 py-3">OPR</th>
                <th className="text-right px-4 py-3">High Score</th>
              </tr>
            </thead>
            <tbody>
              {rankings.slice(0, 20).map((r) => {
                const m = metricsMap.get(r.teamNumber);
                return (
                  <tr key={r.teamNumber} style={{ borderBottom: "1px solid var(--border)" }}
                    className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-bold">{r.rank}</td>
                    <td className="px-4 py-3">
                      <Link href={`/teams/${r.teamNumber}`} className="hover:underline" style={{ color: "var(--accent)" }}>
                        {r.teamNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>
                      {r.wins}-{r.losses}-{r.ties}
                    </td>
                    <td className="px-4 py-3 text-right">{formatScore(m?.opr)}</td>
                    <td className="px-4 py-3 text-right">{r.highScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Picklist */}
      {captainTeams.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Picklist (Balanced Mode)</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Recommended picks for top-4 captains based on OPR + synergy scoring.
          </p>
          {captainTeams.map((captain) => {
            if (!captain) return null;
            const picks = generatePicklist(captain.teamNumber, Array.from(metricsMap.values()), "balanced").slice(0, 5);
            return (
              <div key={captain.teamNumber} className="glass rounded-xl p-4 mb-3">
                <h3 className="font-bold mb-2" style={{ color: "var(--accent)" }}>
                  Captain: {captain.teamNumber}
                </h3>
                <div className="space-y-1">
                  {picks.map((p, i) => (
                    <div key={p.teamNumber} className="flex items-center justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                      <Link href={`/teams/${p.teamNumber}`} className="ml-2 font-semibold hover:underline" style={{ color: "var(--text)" }}>
                        {p.teamNumber}
                      </Link>
                      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>{p.label}</span>
                      <span className="ml-auto font-mono text-xs">{formatScore(p.score)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
