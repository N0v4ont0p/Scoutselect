"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Calendar, MapPin, ChevronRight, Zap, ArrowRight } from "lucide-react";
import { seasonName, cn, getCurrentSeason } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

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
  const { t } = useI18n();
  const router = useRouter();
  const defaultSeason = getCurrentSeason();
  const [season, setSeason] = useState(defaultSeason);
  const [teamInput, setTeamInput] = useState("");
  const [submittedTeam, setSubmittedTeam] = useState<number | null>(null);
  const [events, setEvents] = useState<FTCEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualSeason, setManualSeason] = useState(defaultSeason);

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
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}>
            <Zap className="w-3 h-3" /> {t.events.badge}
          </div>
        </div>
        <h1 className="text-3xl font-black mb-2 animate-slide-up">{t.events.title}</h1>
        <p className="text-sm animate-slide-up stagger-1" style={{ color: "var(--text-muted)" }}>
          {t.events.subtitle}
        </p>
      </div>

      {/* Main input card */}
      <div className="glass rounded-2xl p-6 mb-6 animate-slide-up stagger-2" style={{ border: "1px solid var(--border)" }}>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="sm:col-span-2">
            <label htmlFor="events-team-input" className="text-xs font-semibold uppercase tracking-widest mb-1.5 block"
              style={{ color: "var(--text-muted)" }}>
              {t.events.teamLabel}
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200 focus-within:border-[--accent]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} aria-hidden="true" />
              <input
                id="events-team-input"
                className="flex-1 bg-transparent outline-none text-sm font-mono"
                style={{ color: "var(--text)" }}
                type="number"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t.events.teamPlaceholder}
                value={teamInput}
                onChange={(e) => setTeamInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFindEvents()}
              />
            </div>
          </div>
          <div>
            <label htmlFor="events-season-select" className="text-xs font-semibold uppercase tracking-widest mb-1.5 block"
              style={{ color: "var(--text-muted)" }}>
              {t.events.seasonLabel}
            </label>
            <select
              id="events-season-select"
              className="w-full px-3 py-2.5 rounded-xl text-sm cursor-pointer"
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
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 hover:brightness-110 active:scale-98"
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
          {loading
            ? <><span className="w-4 h-4 border-2 rounded-full animate-spin" aria-hidden="true"
                style={{ borderColor: "rgba(255,255,255,0.4)", borderTopColor: "#fff" }} />
              {t.events.loading}</>
            : <><Search className="w-4 h-4" aria-hidden="true" />{t.events.findBtn}<ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" /></>
          }
        </button>
        {/* Quick hint for first-time visitors */}
        {!submittedTeam && !loading && (
          <p className="mt-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
            {t.events.hint}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-2xl text-sm animate-fade-in" role="alert"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* No results */}
      {submittedTeam && !loading && events.length === 0 && !error && (
        <div className="text-center py-12 animate-fade-in" style={{ color: "var(--text-muted)" }}>
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>{t.events.noEvents.replace("{team}", String(submittedTeam)).replace("{season}", seasonName(season))}</p>
        </div>
      )}

      {/* Event groups */}
      {events.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          {liveEvents.length > 0 && (
            <EventGroup title={t.events.liveNow} events={liveEvents} teamNumber={submittedTeam!} season={season} t={t.events} />
          )}
          {upcomingEvents.length > 0 && (
            <EventGroup title={t.events.upcoming} events={upcomingEvents} teamNumber={submittedTeam!} season={season} t={t.events} />
          )}
          {pastEvents.length > 0 && (
            <EventGroup title={t.events.past} events={pastEvents} teamNumber={submittedTeam!} season={season} t={t.events} />
          )}
        </div>
      )}

      {/* Advanced */}
      <div className="mt-10">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs flex items-center gap-1.5 transition-all duration-200 hover:text-white"
          style={{ color: "var(--text-muted)" }}>
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200", showAdvanced && "rotate-90")} />
          {t.events.manualToggle}
        </button>
        {showAdvanced && (
          <div className="glass rounded-2xl p-4 mt-3 space-y-3 animate-slide-down"
            style={{ border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.events.manualHint}</p>
            <div className="flex gap-2">
              <label htmlFor="manual-season-select" className="sr-only">Season</label>
              <select
                id="manual-season-select"
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                value={manualSeason} onChange={(e) => setManualSeason(Number(e.target.value))}>
                {SEASONS.slice().reverse().map((s) => (
                  <option key={s} value={s}>{s}–{s + 1}</option>
                ))}
              </select>
              <label htmlFor="manual-code-input" className="sr-only">Event code</label>
              <input
                id="manual-code-input"
                className="flex-1 px-3 py-2 rounded-xl text-sm font-mono"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                placeholder={t.events.manualPlaceholder}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualGo()}
              />
              <button onClick={handleManualGo} disabled={!manualCode.trim()}
                className="px-4 py-2 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all hover:brightness-110"
                style={{ background: "var(--accent)", color: "#fff" }}>
                {t.events.manualGo}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventGroup({ title, events, teamNumber, season, t }: {
  title: string;
  events: FTCEvent[];
  teamNumber: number;
  season: number;
  t: { analyzeBtn: string; viewBtn: string; previewBtn: string };
}) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>{title}</h2>
      <div className="space-y-2">
        {events.map((ev, i) => {
          const status = eventStatus(ev);
          const badge = PHASE_BADGE[status];
          const href = `/events/${season}/${ev.code}?team=${teamNumber}`;
          return (
            <a key={ev.code} href={href}
              className="flex items-center justify-between px-4 py-4 rounded-2xl glass glass-hover group"
              style={{ border: "1px solid var(--border)", animationDelay: `${i * 0.04}s` }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ color: badge.color, background: badge.bg }}>
                    {badge.label}
                  </span>
                </div>
                <p className="font-bold text-sm truncate">{ev.name}</p>
                <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <MapPin className="w-3 h-3" />
                  {ev.city}, {ev.stateProv}
                  <span className="mx-1">·</span>
                  <Calendar className="w-3 h-3" />
                  {new Date(ev.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className="text-xs font-semibold hidden sm:block" style={{ color: "var(--accent)" }}>
                  {ev.ongoing ? t.analyzeBtn : ev.finished ? t.viewBtn : t.previewBtn}
                </span>
                <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
                  style={{ color: "var(--accent)" }} />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

