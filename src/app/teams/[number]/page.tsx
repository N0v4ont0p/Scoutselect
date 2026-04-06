import Link from "next/link";
import { ArrowLeft, MapPin, Hash } from "lucide-react";
import { getTeam, getTeamEvents } from "@/lib/ftcscout";
import { seasonName } from "@/lib/utils";

export default async function TeamDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const teamNum = parseInt(number, 10);
  const currentSeason = 2024;

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
        <Link href="/teams" className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <p style={{ color: "var(--danger)" }}>Team {teamNum} not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/teams" className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Teams
      </Link>

      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1" style={{ color: "var(--text-muted)" }}>
              <Hash className="w-4 h-4" /><span className="text-sm">Team {team.teamNumber}</span>
            </div>
            <h1 className="text-3xl font-black mb-1">{team.nameShort}</h1>
            <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>{team.nameFull}</p>
            {team.schoolName && <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>{team.schoolName}</p>}
            <div className="flex items-center gap-1 text-sm" style={{ color: "var(--text-muted)" }}>
              <MapPin className="w-3 h-3" />
              {team.city}, {team.stateProv} · {team.country}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3">{seasonName(currentSeason)} Events</h2>
      {events.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No events found for this season.</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <Link key={ev.code} href={`/events/${currentSeason}/${ev.code}`}
              className="flex items-center justify-between px-4 py-4 rounded-xl glass hover:bg-white/5 transition-colors">
              <div>
                <span className="font-semibold text-sm">{ev.name}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>{ev.city}, {ev.stateProv}</span>
              </div>
              <div className="flex items-center gap-2">
                {ev.finished && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>Complete</span>}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{new Date(ev.start).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
