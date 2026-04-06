import Link from "next/link";
import { Home, MapPin, Hash, Calendar, ChevronRight } from "lucide-react";
import { getTeam, getTeamEvents } from "@/lib/ftcscout";
import { seasonName, getCurrentSeason } from "@/lib/utils";

export default async function TeamDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const teamNum = parseInt(number, 10);
  const currentSeason = getCurrentSeason();

  let team = null;
  let events: { season: number; code: string; name: string; city: string; stateProv: string; start: string; finished: boolean }[] = [];

  try {
    [team, events] = await Promise.all([
      getTeam(teamNum),
      getTeamEvents(teamNum, currentSeason),
    ]);
  } catch { /* team not found */ }

  if (!team) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-6 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <Home className="w-4 h-4" /> Home
        </Link>
        <p style={{ color: "var(--danger)" }}>Team {teamNum} not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Back → home */}
      <Link href="/"
        className="inline-flex items-center gap-2 text-sm mb-8 px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/5"
        style={{ color: "var(--text-muted)" }}>
        <Home className="w-4 h-4" />
        Home
      </Link>

      {/* Team card */}
      <div className="glass rounded-2xl p-6 mb-8" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-3"
              style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <Hash className="w-3 h-3" />
              Team {team.teamNumber}
            </div>
            <h1 className="text-3xl font-black mb-1">{team.nameShort}</h1>
            <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>{team.nameFull}</p>
            {team.schoolName && (
              <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>{team.schoolName}</p>
            )}
            <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              <MapPin className="w-3.5 h-3.5" />
              {team.city}, {team.stateProv} · {team.country}
            </div>
          </div>
        </div>
      </div>

      {/* Events */}
      <h2 className="text-lg font-bold mb-4">
        {seasonName(currentSeason)} Events
      </h2>

      {events.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center" style={{ border: "1px solid var(--border)" }}>
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p style={{ color: "var(--text-muted)" }}>No events found for this season.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <Link key={ev.code} href={`/events/${currentSeason}/${ev.code}`}
              className="flex items-center justify-between px-4 py-4 rounded-2xl glass glass-hover group"
              style={{ border: "1px solid var(--border)" }}>
              <div>
                <span className="font-semibold text-sm">{ev.name}</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <MapPin className="w-3 h-3" />
                  {ev.city}, {ev.stateProv}
                  <span className="mx-1">·</span>
                  <Calendar className="w-3 h-3" />
                  {new Date(ev.start).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {ev.finished && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    Complete
                  </span>
                )}
                <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
                  style={{ color: "var(--accent)" }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

