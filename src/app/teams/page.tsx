"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Home, ChevronRight } from "lucide-react";
import { useI18n } from "@/context/LanguageContext";

interface TeamResult {
  teamNumber: number;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
}

function TeamsContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<TeamResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearchError(""); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/search/teams?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setResults(Array.isArray(data) ? data : []);
      } catch (e) { setResults([]); setSearchError(String(e)); }
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      {/* Back → home */}
      <Link href="/"
        className="inline-flex items-center gap-2 text-sm mb-8 px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/5"
        style={{ color: "var(--text-muted)" }}>
        <Home className="w-4 h-4" />
        {t.teams.back}
      </Link>

      <h1 className="text-3xl font-black mb-6 animate-slide-up">{t.teams.title}</h1>

      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl glass mb-6 animate-slide-up stagger-1 transition-all duration-300 focus-within:border-[--accent] focus-within:shadow-[0_0_16px_rgba(99,102,241,0.15)]"
        style={{ border: "1px solid var(--border)" }}>
        <Search className="w-5 h-5 shrink-0 transition-colors" style={{ color: loading ? "var(--accent)" : "var(--text-muted)" }} aria-hidden="true" />
        <label htmlFor="teams-search-input" className="sr-only">{t.teams.placeholder}</label>
        <input
          id="teams-search-input"
          autoFocus
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder={t.teams.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ color: "var(--text)" }}
          role="searchbox"
          aria-label={t.teams.placeholder}
          autoComplete="off"
        />
        {loading && (
          <div className="w-4 h-4 border-2 rounded-full animate-spin shrink-0" aria-hidden="true"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        )}
      </div>

      {/* Error */}
      {searchError && (
        <p className="text-center py-8 text-sm animate-fade-in" style={{ color: "var(--danger)" }}>
          {t.teams.error}
        </p>
      )}

      {/* Results */}
      {!searchError && results.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          {results.map((team, i) => (
            <Link key={team.teamNumber} href={`/teams/${team.teamNumber}`}
              className="flex items-center justify-between px-4 py-4 rounded-2xl glass glass-hover group"
              style={{ animationDelay: `${i * 0.04}s` }}>
              <div>
                <span className="font-bold text-base" style={{ color: "var(--accent)" }}>{team.teamNumber}</span>
                <span className="ml-3 text-sm">{team.nameShort}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm hidden sm:block" style={{ color: "var(--text-muted)" }}>
                  {team.city}, {team.stateProv} · {team.country}
                </span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
                  style={{ color: "var(--accent)" }} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !searchError && query && results.length === 0 && (
        <p className="text-center py-12 animate-fade-in" style={{ color: "var(--text-muted)" }}>
          {t.teams.notFound.replace("{query}", query)}
        </p>
      )}
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense>
      <TeamsContent />
    </Suspense>
  );
}

