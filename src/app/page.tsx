"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import type React from "react";
import Link from "next/link";
import {
  Search, Zap, BarChart2, Target, Users, TrendingUp,
  Calendar, MapPin, ChevronRight, ArrowRight, Database,
} from "lucide-react";
import { seasonName, getCurrentSeason } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

interface TeamResult {
  teamNumber: number;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
}

interface EventSummary {
  season: number;
  code: string;
  name: string;
  city: string;
  stateProv: string;
  start: string;
  ongoing: boolean;
  finished: boolean;
}

export default function Home() {
  const { t } = useI18n();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Primary CTA
  const [ctaTeam, setCtaTeam] = useState("");
  const ctaInputId = "cta-team-input";

  // Team search (secondary)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [teamActiveIdx, setTeamActiveIdx] = useState(-1);
  const teamDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamListId = "team-search-listbox";

  // Live / upcoming events
  const [liveEvents, setLiveEvents] = useState<EventSummary[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventSummary[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveSeason, setLiveSeason] = useState(0);

  // Event search (secondary)
  const [eventQuery, setEventQuery] = useState("");
  const [eventResults, setEventResults] = useState<EventSummary[]>([]);
  const [eventSearchLoading, setEventSearchLoading] = useState(false);
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [eventSeason, setEventSeason] = useState(getCurrentSeason());
  const [eventActiveIdx, setEventActiveIdx] = useState(-1);
  const eventDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventListId = "event-search-listbox";

  const currentSeason = getCurrentSeason();

  useEffect(() => { setMounted(true); }, []);

  // Close dropdowns on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setEventSearchOpen(false);
        setTeamActiveIdx(-1);
        setEventActiveIdx(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch live/upcoming events on mount
  useEffect(() => {
    fetch("/api/events/live")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setLiveEvents(data.live ?? []);
          setUpcomingEvents(data.upcoming ?? []);
          setLiveSeason(data.season ?? getCurrentSeason());
        }
      })
      .catch(() => {})
      .finally(() => setLiveLoading(false));
  }, []);

  // Team search debounce
  useEffect(() => {
    if (teamDebounceRef.current) clearTimeout(teamDebounceRef.current);
    if (!query.trim()) { setResults([]); setSearchError(""); setOpen(false); setTeamActiveIdx(-1); return; }
    teamDebounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/search/teams?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
        setTeamActiveIdx(-1);
      } catch (e) { setResults([]); setSearchError(String(e)); setOpen(true); }
      setLoading(false);
    }, 300);
    return () => { if (teamDebounceRef.current) clearTimeout(teamDebounceRef.current); };
  }, [query]);

  // Event search debounce
  useEffect(() => {
    if (eventDebounceRef.current) clearTimeout(eventDebounceRef.current);
    if (!eventQuery.trim()) { setEventResults([]); setEventSearchOpen(false); setEventActiveIdx(-1); return; }
    eventDebounceRef.current = setTimeout(async () => {
      setEventSearchLoading(true);
      try {
        const res = await fetch(
          `/api/events/search?q=${encodeURIComponent(eventQuery.trim())}&season=${eventSeason}`
        );
        const data = await res.json();
        setEventResults(Array.isArray(data) ? data : []);
        setEventSearchOpen(true);
        setEventActiveIdx(-1);
      } catch { setEventResults([]); }
      setEventSearchLoading(false);
    }, 300);
    return () => { if (eventDebounceRef.current) clearTimeout(eventDebounceRef.current); };
  }, [eventQuery, eventSeason]);

  const featureData = [
    { icon: <Target className="w-5 h-5" />, key: "role" as const },
    { icon: <BarChart2 className="w-5 h-5" />, key: "pick" as const },
    { icon: <Users className="w-5 h-5" />, key: "pitch" as const },
    { icon: <TrendingUp className="w-5 h-5" />, key: "synergy" as const },
    { icon: <Zap className="w-5 h-5" />, key: "win" as const },
    { icon: <Search className="w-5 h-5" />, key: "discover" as const },
  ];

  const showLiveSection = !liveLoading && (liveEvents.length > 0 || upcomingEvents.length > 0);
  const teamDropdownActive = open && (results.length > 0 || !!searchError);
  const eventDropdownActive = eventSearchOpen && eventResults.length > 0;

  function handleCtaNavigate() {
    if (ctaTeam.trim()) router.push(`/events?team=${ctaTeam.trim()}`);
  }

  const handleTeamKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!teamDropdownActive) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTeamActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTeamActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && teamActiveIdx >= 0) {
      e.preventDefault();
      const team = results[teamActiveIdx];
      if (team) router.push(`/teams/${team.teamNumber}`);
      setOpen(false);
    }
  }, [teamDropdownActive, results, teamActiveIdx, router]);

  const handleEventKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!eventDropdownActive) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setEventActiveIdx((i) => Math.min(i + 1, eventResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setEventActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && eventActiveIdx >= 0) {
      e.preventDefault();
      const ev = eventResults[eventActiveIdx];
      if (ev) router.push(`/events/${ev.season}/${ev.code}`);
      setEventSearchOpen(false);
    }
  }, [eventDropdownActive, eventResults, eventActiveIdx, router]);

  const ACTIVE_BORDER = "1px solid rgba(99,102,241,0.5)";
  const DEFAULT_BORDER = "1px solid var(--border)";
  const DROPDOWN_STYLE: React.CSSProperties = {
    background: "rgba(13,17,23,0.97)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(99,102,241,0.35)",
    boxShadow: "0 24px 72px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
  };

  const badgeText = (t.home.badge as string).replace("{season}", seasonName(currentSeason));

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Hero */}
      <section className="relative max-w-4xl mx-auto px-4 pt-10 pb-5 text-center" style={{ zIndex: 10 }}>
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Season / trust badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5 animate-fade-in ${mounted ? "" : "opacity-0"}`}
          style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <Zap className="w-3 h-3" aria-hidden="true" />
          {badgeText}
        </div>

        <h1 className={`text-5xl sm:text-7xl font-black mb-3 leading-tight animate-slide-up stagger-1 ${mounted ? "" : "opacity-0"}`}>
          <span className="gradient-text">{t.home.headline}</span>
        </h1>

        <p
          className={`text-lg sm:text-xl mb-6 max-w-2xl mx-auto animate-slide-up stagger-2 ${mounted ? "" : "opacity-0"}`}
          style={{ color: "var(--text-muted)" }}>
          {t.home.subheadline}
        </p>

        {/* Primary CTA */}
        <div className={`max-w-sm mx-auto mb-4 animate-slide-up stagger-2 ${mounted ? "" : "opacity-0"}`}>
          <label
            htmlFor={ctaInputId}
            className="block text-xs font-semibold uppercase tracking-widest mb-2 text-center"
            style={{ color: "var(--text-muted)" }}>
            {t.home.ctaLabel}
          </label>
          <div className="flex gap-2">
            <input
              id={ctaInputId}
              type="number"
              inputMode="numeric"
              autoComplete="off"
              className="flex-1 px-4 py-3 rounded-xl text-sm font-mono"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              placeholder={t.home.ctaPlaceholder}
              value={ctaTeam}
              onChange={(e) => setCtaTeam(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCtaNavigate(); }}
              aria-label={t.home.ctaLabel}
            />
            <button
              onClick={handleCtaNavigate}
              disabled={!ctaTeam.trim()}
              className="px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-40 hover:brightness-110 whitespace-nowrap"
              style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
              {t.home.ctaBtn}
            </button>
          </div>
        </div>

        {/* Pills */}
        <div className={`flex items-center justify-center gap-2 mb-5 flex-wrap animate-slide-up stagger-2 ${mounted ? "" : "opacity-0"}`}>
          {(t.home.pills as string[]).map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.25)" }}>
              &#10003; {label}
            </span>
          ))}
        </div>

        {/* Data source trust indicator */}
        <p
          className={`text-xs mb-4 animate-fade-in ${mounted ? "" : "opacity-0"}`}
          style={{ color: "var(--text-muted)" }}>
          <Database className="w-3 h-3 inline-block mr-1 align-middle" aria-hidden="true" />
          {t.home.dataSource}
        </p>

        {/* Secondary search separator */}
        <div className={`flex items-center gap-3 max-w-lg mx-auto mb-4 animate-fade-in ${mounted ? "" : "opacity-0"}`}>
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{t.home.orSeparator}</span>
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>

        {/* Team Search */}
        {teamDropdownActive && (
          <div
            className="fixed inset-0"
            style={{ zIndex: 95 }}
            onClick={() => { setOpen(false); setTeamActiveIdx(-1); }}
            aria-hidden="true"
          />
        )}
        <div
          className={`relative max-w-lg mx-auto mb-2 animate-slide-up stagger-3 ${mounted ? "" : "opacity-0"}`}
          style={{ zIndex: 100 }}>
          <div
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl glass transition-all duration-300 focus-within:border-[--accent] focus-within:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
            style={{ border: teamDropdownActive ? ACTIVE_BORDER : DEFAULT_BORDER }}
            role="combobox"
            aria-expanded={teamDropdownActive}
            aria-haspopup="listbox"
            aria-controls={teamListId}>
            <Search
              className="w-5 h-5 shrink-0 transition-colors duration-200"
              style={{ color: loading ? "var(--accent)" : "var(--text-muted)" }}
              aria-hidden="true" />
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder={t.home.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleTeamKeyDown}
              style={{ color: "var(--text)" }}
              aria-label={t.home.searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={teamListId}
              aria-activedescendant={teamActiveIdx >= 0 ? `team-opt-${teamActiveIdx}` : undefined}
              autoComplete="off"
            />
            {loading && (
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
                aria-label="Loading" />
            )}
          </div>

          {teamDropdownActive && (
            <div
              id={teamListId}
              className="absolute top-full mt-2 w-full rounded-2xl py-1.5 animate-scale-in"
              style={{ ...DROPDOWN_STYLE, zIndex: 110 }}
              role="listbox"
              aria-label="Team search results">
              {searchError
                ? <p className="px-4 py-3 text-sm" style={{ color: "var(--danger)" }} role="alert">{t.teams.error}</p>
                : results.length === 0
                  ? <p className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>No results for &ldquo;{query}&rdquo;</p>
                  : results.map((team, i) => (
                    <Link
                      key={team.teamNumber}
                      id={`team-opt-${i}`}
                      href={`/teams/${team.teamNumber}`}
                      className="flex items-center justify-between px-4 py-3 transition-all duration-150 first:rounded-t-2xl last:rounded-b-2xl group"
                      style={{
                        background: teamActiveIdx === i ? "rgba(99,102,241,0.12)" : undefined,
                      }}
                      role="option"
                      aria-selected={teamActiveIdx === i}
                      onClick={() => { setOpen(false); setTeamActiveIdx(-1); }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="shrink-0 font-black text-base tabular-nums px-2 py-0.5 rounded-lg"
                          style={{ color: "var(--accent)", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
                          {team.teamNumber}
                        </span>
                        <span className="font-semibold text-sm truncate group-hover:text-white transition-colors" style={{ color: "var(--text)" }}>{team.nameShort}</span>
                      </div>
                      <span className="text-xs hidden sm:block shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>
                        {team.city}, {team.stateProv}
                      </span>
                    </Link>
                  ))
              }
            </div>
          )}
        </div>

        {/* Event Search */}
        {eventDropdownActive && (
          <div
            className="fixed inset-0"
            style={{ zIndex: 85 }}
            onClick={() => { setEventSearchOpen(false); setEventActiveIdx(-1); }}
            aria-hidden="true"
          />
        )}
        <div
          className={`relative max-w-lg mx-auto mb-5 animate-slide-up stagger-3 ${mounted ? "" : "opacity-0"}`}
          style={{ zIndex: 90 }}>
          <div className="flex gap-2">
            <div
              className="flex-1 flex items-center gap-3 px-4 py-3.5 rounded-2xl glass transition-all duration-300 focus-within:border-[--accent] focus-within:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
              style={{ border: eventDropdownActive ? ACTIVE_BORDER : DEFAULT_BORDER }}
              role="combobox"
              aria-expanded={eventDropdownActive}
              aria-haspopup="listbox"
              aria-controls={eventListId}>
              <Calendar
                className="w-5 h-5 shrink-0"
                style={{ color: eventSearchLoading ? "var(--accent)" : "var(--text-muted)" }}
                aria-hidden="true" />
              <input
                className="flex-1 bg-transparent outline-none text-sm"
                placeholder={t.home.eventSearchPlaceholder}
                value={eventQuery}
                onChange={(e) => setEventQuery(e.target.value)}
                onKeyDown={handleEventKeyDown}
                style={{ color: "var(--text)" }}
                aria-label={t.home.eventSearchPlaceholder}
                aria-autocomplete="list"
                aria-controls={eventListId}
                aria-activedescendant={eventActiveIdx >= 0 ? `event-opt-${eventActiveIdx}` : undefined}
                autoComplete="off"
              />
              {eventSearchLoading && (
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
                  style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
                  aria-label="Loading" />
              )}
            </div>
            <label htmlFor="event-season-select" className="sr-only">Season</label>
            <select
              id="event-season-select"
              className="px-3 py-2 rounded-2xl text-sm cursor-pointer font-semibold"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              value={eventSeason}
              onChange={(e) => setEventSeason(Number(e.target.value))}>
              {SEASONS.slice().reverse().map((s) => (
                <option key={s} value={s}>{s}–{s + 1}</option>
              ))}
            </select>
          </div>

          {eventDropdownActive && (
            <div
              id={eventListId}
              className="absolute top-full mt-2 w-full rounded-2xl py-1.5 animate-scale-in"
              style={{ ...DROPDOWN_STYLE, zIndex: 100 }}
              role="listbox"
              aria-label="Event search results">
              {eventResults.map((ev, i) => (
                <Link
                  key={`${ev.season}-${ev.code}`}
                  id={`event-opt-${i}`}
                  href={`/events/${ev.season}/${ev.code}`}
                  className="flex items-center justify-between px-4 py-3 transition-all duration-150 first:rounded-t-2xl last:rounded-b-2xl group"
                  style={{
                    background: eventActiveIdx === i ? "rgba(99,102,241,0.12)" : undefined,
                  }}
                  role="option"
                  aria-selected={eventActiveIdx === i}
                  onClick={() => { setEventSearchOpen(false); setEventQuery(""); setEventActiveIdx(-1); }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {ev.ongoing && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                          style={{ color: "var(--danger)", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
                          &#128308; Live
                        </span>
                      )}
                      <span className="font-bold text-sm truncate group-hover:text-white transition-colors">{ev.name}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <MapPin className="w-3 h-3" aria-hidden="true" />{ev.city}, {ev.stateProv}
                      <span className="mx-1" aria-hidden="true">&middot;</span>
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      {new Date(ev.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" style={{ color: "var(--accent)" }} aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Quick Links */}
      <section className="max-w-4xl mx-auto px-4 pb-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <Link
            href="/events"
            className="glass glass-hover rounded-2xl p-4 flex items-center gap-3 group"
            style={{ border: "1px solid var(--border)" }}>
            <div className="p-2 rounded-xl shrink-0" style={{ background: "rgba(99,102,241,0.12)" }}>
              <Calendar className="w-4 h-4" style={{ color: "var(--accent)" }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{t.home.quickLinks.events}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{t.home.quickLinks.eventsDesc}</p>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "var(--accent)" }} aria-hidden="true" />
          </Link>
          <Link
            href="/teams"
            className="glass glass-hover rounded-2xl p-4 flex items-center gap-3 group"
            style={{ border: "1px solid var(--border)" }}>
            <div className="p-2 rounded-xl shrink-0" style={{ background: "rgba(99,102,241,0.12)" }}>
              <Users className="w-4 h-4" style={{ color: "var(--accent)" }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{t.home.quickLinks.teams}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{t.home.quickLinks.teamsDesc}</p>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "var(--accent)" }} aria-hidden="true" />
          </Link>
          <Link
            href="/compare"
            className="glass glass-hover rounded-2xl p-4 flex items-center gap-3 group"
            style={{ border: "1px solid var(--border)" }}>
            <div className="p-2 rounded-xl shrink-0" style={{ background: "rgba(99,102,241,0.12)" }}>
              <BarChart2 className="w-4 h-4" style={{ color: "var(--accent)" }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{t.home.quickLinks.compare}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{t.home.quickLinks.compareDesc}</p>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "var(--accent)" }} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Live / Upcoming Events */}
      {(liveLoading || showLiveSection) && (
        <section className="max-w-4xl mx-auto px-4 pt-3 pb-6" aria-label="Current events">
          {liveLoading ? (
            <div className="flex items-center justify-center py-6" aria-busy="true" aria-label="Loading events">
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : (
            <>
              {liveEvents.length > 0 && (
                <div className="mb-4">
                  <h2
                    className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                    style={{ color: "var(--danger)" }}>
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: "var(--danger)" }}
                      aria-hidden="true" />
                    {t.home.liveNow}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {liveEvents.map((ev) => (
                      <Link
                        key={ev.code}
                        href={`/events/${liveSeason}/${ev.code}`}
                        className="glass glass-hover rounded-2xl p-3.5 flex items-center justify-between group"
                        style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{ev.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                            <MapPin className="w-3 h-3" aria-hidden="true" />{ev.city}, {ev.stateProv}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: "var(--danger)", background: "rgba(239,68,68,0.12)" }}>
                            &#128308; Live
                          </span>
                          <ChevronRight
                            className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-all group-hover:translate-x-0.5"
                            style={{ color: "var(--accent)" }}
                            aria-hidden="true" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {upcomingEvents.length > 0 && (
                <div>
                  <h2
                    className="text-xs font-bold uppercase tracking-widest mb-3"
                    style={{ color: "var(--text-muted)" }}>
                    {t.home.upcomingEvents}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {upcomingEvents.slice(0, 6).map((ev) => (
                      <Link
                        key={ev.code}
                        href={`/events/${liveSeason}/${ev.code}`}
                        className="glass glass-hover rounded-2xl p-3.5 flex items-center justify-between group"
                        style={{ border: "1px solid var(--border)" }}>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{ev.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                            <MapPin className="w-3 h-3" aria-hidden="true" />{ev.city}, {ev.stateProv}
                            <span className="mx-1" aria-hidden="true">&middot;</span>
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            {new Date(ev.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </div>
                        <ChevronRight
                          className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 shrink-0 ml-2"
                          style={{ color: "var(--accent)" }}
                          aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Feature Cards */}
      <section className="max-w-4xl mx-auto px-4 pb-8" aria-labelledby="features-heading">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          <h2
            id="features-heading"
            className="text-xs font-bold uppercase tracking-widest px-2"
            style={{ color: "var(--text-muted)" }}>
            {t.home.featuresTitle}
          </h2>
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>
        <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left ${mounted ? "" : "opacity-0"}`}>
          {featureData.map((f, i) => (
            <div
              key={f.key}
              className="glass glass-hover rounded-2xl p-4 animate-fade-in"
              style={{ animationDelay: `${0.1 + i * 0.07}s`, opacity: 0, animationFillMode: "forwards", borderLeft: "2px solid rgba(99,102,241,0.25)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--accent)" }}>
                <div className="p-1.5 rounded-lg" style={{ background: "rgba(99,102,241,0.12)" }} aria-hidden="true">
                  {f.icon}
                </div>
                <span className="font-semibold text-sm">{t.home.features[f.key].title}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {t.home.features[f.key].desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Season Links */}
      <section className="max-w-4xl mx-auto px-4 pb-14 text-center" aria-labelledby="seasons-heading">
        <h2
          id="seasons-heading"
          className="text-xs font-bold uppercase tracking-widest mb-3"
          style={{ color: "var(--text-muted)" }}>
          {t.home.seasonsTitle}
        </h2>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {SEASONS.slice().reverse().map((s, i) => (
            <Link
              key={s}
              href={`/seasons/${s}`}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 hover:border-[--accent] hover:text-white"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                animationDelay: `${i * 0.05}s`,
              }}>
              {seasonName(s)}
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t text-center py-8 text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        {t.home.footer}{" "}
        <span style={{ color: "var(--accent)" }}>FTC Team 19859</span>
        {" · "}
        {t.home.footerPowered}{" "}
        <a
          href="https://ftcscout.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white transition-colors">
          FTCScout API
        </a>
      </footer>
    </div>
  );
}
