"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, Zap, BarChart2, Target, Users, TrendingUp } from "lucide-react";
import { seasonName } from "@/lib/utils";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

interface TeamResult {
  teamNumber: number;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/teams?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const features = [
    { icon: <BarChart2 className="w-5 h-5" />, title: "OPR Analytics", desc: "True offensive power ratings via Gaussian elimination across all qual matches." },
    { icon: <Target className="w-5 h-5" />, title: "Monte Carlo Sim", desc: "Win-probability estimates using Box-Muller sampling — 1,000 runs per matchup." },
    { icon: <Users className="w-5 h-5" />, title: "Synergy Scoring", desc: "Role fingerprints in auto/teleop/endgame space with complementarity scoring." },
    { icon: <TrendingUp className="w-5 h-5" />, title: "Picklist Generator", desc: "Safe · Balanced · Ceiling · Counter modes with smart filters." },
    { icon: <Zap className="w-5 h-5" />, title: "Phase Detection", desc: "Auto-detects event phase and surfaces the most relevant analytics tab." },
    { icon: <Search className="w-5 h-5" />, title: "Live Data", desc: "Powered by the FTCScout public API with smart TTL caching." },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <nav className="glass sticky top-0 z-50 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg gradient-text">⚡ ScoutSelect</span>
          <div className="hidden sm:flex gap-6 text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/teams" className="hover:text-white transition-colors">Teams</Link>
            <Link href="/events" className="hover:text-white transition-colors">Events</Link>
            <Link href="/seasons" className="hover:text-white transition-colors">Seasons</Link>
            <Link href="/compare" className="hover:text-white transition-colors">Compare</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
          style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <Zap className="w-3 h-3" /> FTC Alliance Intelligence
        </div>
        <h1 className="text-5xl sm:text-6xl font-black mb-4 leading-tight">
          <span className="gradient-text">ScoutSelect</span>
        </h1>
        <p className="text-xl mb-10" style={{ color: "var(--text-muted)" }}>
          Data-first alliance selection for FTC teams. OPR · Monte Carlo · Synergy Scoring
        </p>

        {/* Search */}
        <div className="relative max-w-lg mx-auto mb-16">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl glass">
            <Search className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
            <input
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder="Search team number or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ color: "var(--text)" }}
            />
            {loading && <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />}
          </div>
          {open && results.length > 0 && (
            <div className="absolute top-full mt-1 w-full rounded-xl glass z-50 py-1 shadow-xl">
              {results.map((t) => (
                <Link key={t.teamNumber} href={`/teams/${t.teamNumber}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  onClick={() => setOpen(false)}>
                  <div>
                    <span className="font-semibold text-sm">{t.teamNumber}</span>
                    <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>{t.nameShort}</span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.city}, {t.stateProv}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left mb-16">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--accent)" }}>
                {f.icon}
                <span className="font-semibold text-sm">{f.title}</span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Season quick-links */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-muted)" }}>Seasons</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {SEASONS.slice().reverse().map((s) => (
              <Link key={s} href={`/seasons/${s}`}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}>
                {seasonName(s)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t text-center py-8 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        Built by <span style={{ color: "var(--accent)" }}>FTC Team 19859</span> · Powered by{" "}
        <a href="https://ftcscout.org" target="_blank" rel="noopener noreferrer" className="underline">FTCScout API</a>
      </footer>
    </div>
  );
}
