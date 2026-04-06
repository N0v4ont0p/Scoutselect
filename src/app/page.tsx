"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, Zap, BarChart2, Target, Users, TrendingUp } from "lucide-react";
import { seasonName } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

interface TeamResult {
  teamNumber: number;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
}

export default function Home() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearchError(""); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/search/teams?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch (e) { setResults([]); setSearchError(String(e)); setOpen(true); }
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const featureData = [
    { icon: <Target className="w-5 h-5" />, key: "role" as const },
    { icon: <BarChart2 className="w-5 h-5" />, key: "pick" as const },
    { icon: <Users className="w-5 h-5" />, key: "pitch" as const },
    { icon: <TrendingUp className="w-5 h-5" />, key: "synergy" as const },
    { icon: <Zap className="w-5 h-5" />, key: "win" as const },
    { icon: <Search className="w-5 h-5" />, key: "discover" as const },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* ── Hero ── */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-16 text-center">
        {/* Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6 animate-fade-in ${mounted ? "" : "opacity-0"}`}
          style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <Zap className="w-3 h-3 animate-pulse-glow" style={{ animationDuration: "2s" }} />
          {t.home.badge}
        </div>

        {/* Headline */}
        <h1 className={`text-5xl sm:text-7xl font-black mb-4 leading-tight animate-slide-up stagger-1 ${mounted ? "" : "opacity-0"}`}>
          <span className="gradient-text">{t.home.headline}</span>
        </h1>

        <p className={`text-lg sm:text-xl mb-6 max-w-2xl mx-auto animate-slide-up stagger-2 ${mounted ? "" : "opacity-0"}`}
          style={{ color: "var(--text-muted)" }}>
          {t.home.subheadline}
        </p>

        {/* Free / unlimited pill */}
        <div className={`flex items-center justify-center gap-3 mb-10 animate-slide-up stagger-2 ${mounted ? "" : "opacity-0"}`}>
          {["Free forever", "No sign-up", "Unlimited analyses"].map((label) => (
            <span key={label} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.25)" }}>
              ✓ {label}
            </span>
          ))}
        </div>

        {/* ── Search ── */}
        <div className={`relative max-w-lg mx-auto mb-16 animate-slide-up stagger-3 ${mounted ? "" : "opacity-0"}`} style={{ zIndex: 60 }}>
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl glass transition-all duration-300 focus-within:border-[--accent] focus-within:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
            style={{ border: "1px solid var(--border)" }}>
            <Search className="w-5 h-5 shrink-0 transition-colors duration-200" style={{ color: loading ? "var(--accent)" : "var(--text-muted)" }} />
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder={t.home.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ color: "var(--text)" }}
            />
            {loading && (
              <div className="w-4 h-4 border-2 rounded-full animate-spin shrink-0"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            )}
          </div>

          {open && (results.length > 0 || searchError) && (
            <div className="absolute top-full mt-2 w-full rounded-2xl glass z-50 py-1.5 shadow-2xl animate-scale-in"
              style={{ border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)" }}>
              {searchError
                ? <p className="px-4 py-3 text-sm" style={{ color: "var(--danger)" }}>
                    {t.teams.error}
                  </p>
                : results.map((team, i) => (
                  <Link key={team.teamNumber} href={`/teams/${team.teamNumber}`}
                    className="flex items-center justify-between px-4 py-3 transition-all duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-white/5"
                    style={{ animationDelay: `${i * 0.04}s` }}
                    onClick={() => setOpen(false)}>
                    <div>
                      <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>
                        {team.teamNumber}
                      </span>
                      <span className="ml-2 text-sm">{team.nameShort}</span>
                    </div>
                    <span className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
                      {team.city}, {team.stateProv}
                    </span>
                  </Link>
                ))
              }
            </div>
          )}
        </div>

        {/* ── Feature Cards ── */}
        <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left mb-16 ${mounted ? "" : "opacity-0"}`}>
          {featureData.map((f, i) => (
            <div key={f.key}
              className="glass glass-hover rounded-2xl p-5 animate-fade-in"
              style={{ animationDelay: `${0.1 + i * 0.07}s`, opacity: 0, animationFillMode: "forwards" }}>
              <div className="flex items-center gap-2 mb-2.5" style={{ color: "var(--accent)" }}>
                <div className="p-1.5 rounded-lg" style={{ background: "rgba(99,102,241,0.12)" }}>
                  {f.icon}
                </div>
                <span className="font-semibold text-sm">{t.home.features[f.key].title}</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {t.home.features[f.key].desc}
              </p>
            </div>
          ))}
        </div>

        {/* ── Season Links ── */}
        <div className={`animate-fade-in stagger-6 ${mounted ? "" : "opacity-0"}`}>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
            {t.home.seasonsTitle}
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {SEASONS.slice().reverse().map((s, i) => (
              <Link key={s} href={`/seasons/${s}`}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 hover:border-[--accent]"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  animationDelay: `${i * 0.05}s`,
                }}>
                {seasonName(s)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t text-center py-8 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        {t.home.footer}{" "}
        <span style={{ color: "var(--accent)" }}>FTC Team 19859</span>
        {" · "}
        {t.home.footerPowered}{" "}
        <a href="https://ftcscout.org" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-white transition-colors">
          FTCScout API
        </a>
      </footer>
    </div>
  );
}


