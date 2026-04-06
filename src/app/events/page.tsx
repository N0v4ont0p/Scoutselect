"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Calendar, MapPin, ChevronRight, Zap, ArrowRight } from "lucide-react";
import { seasonName, cn } from "@/lib/utils";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

interface FTCEvent {
  season: number;
  code: string;
  name: string;
  city: string;
  stateProv: string;
  start: string;
  ongoing: boolean;
  finished: boolean;
}

const PHASE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  ongoing:  { label: "🔴 Live",     color: "var(--danger)",   bg: "rgba(239,68,68,0.12)" },
  upcoming: { label: "📅 Upcoming", color: "var(--warning)",  bg: "rgba(245,158,11,0.12)" },
  finished: { label: "✅ Complete", color: "var(--text-muted)", bg: "var(--surface-2)" },
};

function eventStatus(ev: FTCEvent) {
  if (ev.ongoing) return "ongoing";
  if (ev.finished) return "finished";
  return "upcoming";
}

export default function EventsPage() {
  const router = useRouter();
  const [season, setSeason] = useState(2024);
  const [teamInput, setTeamInput] = useState("");
  const [submittedTeam, setSubmittedTeam] = useState<number | null>(null);
  const [events, setEvents] = useState<FTCEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Advanced (manual code) toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualSeason, setManualSeason] = useState(2024);

  async function handleFindEvents() {
    const n = parseInt(teamInput.trim(), 10);
    if (!n) return;
    setLoading(true);
    setError("");
    setEvents([]);
    setSubmittedTeam(n);
    try {
      const res = await fetch(`/api/team/${n}/events?season=${season}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  function handleManualGo() {
    if (manualCode.trim()) {
      router.push(`/events/${manualSeason}/${manualCode.trim().toUpperCase()}`);
    }
  }

  const liveEvents = events.filter((e) => e.ongoing);
  const upcomingEvents = events.filter((e) => !e.ongoing && !e.finished);
  const pastEvents = events.filter((e) => e.finished);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
          style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <Zap className="w-3 h-3" /> Alliance Analysis
        </div>
        <h1 className="text-3xl font-black mb-2">Analyze Your Event</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Enter your team number to see your events — then click any to get full alliance selection analysis.
        </p>
      </div>

      {/* Main input card */}
      <div className="glass rounded-2xl p-6 mb-6" style={{ border: "1px solid var(--border)" }}>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: "var(--text-muted)" }}>Your Team Number</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                className="flex-1 bg-transparent outline-none text-sm font-mono"
                style={{ color: "var(--text)" }}
                placeholder="e.g. 19859"
                value={teamInput}
                onChange={(e) => setTeamInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFindEvents()}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: "var(--text-muted)" }}>Season</label>
            <select
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}>
              {SEASONS.slice().reverse().map((s) => (
                <option key={s} value={s}>{seasonName(s)}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleFindEvents}
          disabled={loading || !teamInput.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}>
          {loading
            ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.4)", borderTopColor: "#fff" }} /> Loading events…</span>
            : <><Search className="w-4 h-4" /> Find My Events <ArrowRight className="w-4 h-4 ml-1" /></>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* Results */}
      {submittedTeam && !loading && events.length === 0 && !error && (
        <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No events found for Team {submittedTeam} in {seasonName(season)}.</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-6">
          {/* Live events */}
          {liveEvents.length > 0 && (
            <EventGroup title="🔴 Live Now" events={liveEvents} teamNumber={submittedTeam!} season={season} />
          )}
          {/* Upcoming */}
          {upcomingEvents.length > 0 && (
            <EventGroup title="📅 Upcoming" events={upcomingEvents} teamNumber={submittedTeam!} season={season} />
          )}
          {/* Past */}
          {pastEvents.length > 0 && (
            <EventGroup title="✅ Past Events" events={pastEvents} teamNumber={submittedTeam!} season={season} />
          )}
        </div>
      )}

      {/* Advanced: manual event code entry */}
      <div className="mt-8">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs flex items-center gap-1.5 transition-colors hover:text-white"
          style={{ color: "var(--text-muted)" }}>
          <ChevronRight className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-90")} />
          Enter event code manually
        </button>
        {showAdvanced && (
          <div className="glass rounded-xl p-4 mt-3 space-y-3" style={{ border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              If you know the FTCScout event code, enter it here directly.
            </p>
            <div className="flex gap-2">
              <select className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                value={manualSeason} onChange={(e) => setManualSeason(Number(e.target.value))}>
                {SEASONS.slice().reverse().map((s) => (
                  <option key={s} value={s}>{s}–{s + 1}</option>
                ))}
              </select>
              <input
                className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                placeholder="Event code (e.g. USMDCMPF1)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualGo()}
              />
              <button onClick={handleManualGo} disabled={!manualCode.trim()}
                className="px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}>
                Go →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventGroup({ title, events, teamNumber, season }: {
  title: string;
  events: FTCEvent[];
  teamNumber: number;
  season: number;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-2.5" style={{ color: "var(--text-muted)" }}>{title}</h2>
      <div className="space-y-2">
        {events.map((ev) => {
          const status = eventStatus(ev);
          const badge = PHASE_BADGE[status];
          const href = `/events/${season}/${ev.code}?team=${teamNumber}`;
          return (
            <a key={ev.code} href={href}
              className="flex items-center justify-between px-4 py-4 rounded-xl glass hover:bg-white/5 transition-all group"
              style={{ border: "1px solid var(--border)" }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ color: badge.color, background: badge.bg }}>
                    {badge.label}
                  </span>
                </div>
                <p className="font-bold text-sm truncate">{ev.name}</p>
                <div className="flex items-center gap-1 mt-0.5 text-xs"
                  style={{ color: "var(--text-muted)" }}>
                  <MapPin className="w-3 h-3" />
                  {ev.city}, {ev.stateProv}
                  <span className="mx-1">·</span>
                  <Calendar className="w-3 h-3" />
                  {new Date(ev.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className="text-xs font-semibold hidden sm:block"
                  style={{ color: "var(--accent)" }}>
                  {ev.ongoing ? "Analyze Live →" : ev.finished ? "View Analysis →" : "Preview →"}
                </span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  style={{ color: "var(--accent)" }} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
