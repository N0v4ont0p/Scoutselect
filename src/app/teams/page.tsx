"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";

interface TeamResult {
  teamNumber: number;
  nameShort: string;
  city: string;
  stateProv: string;
  country: string;
}

function TeamsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-3xl font-black mb-6">Team Search</h1>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl glass mb-6">
        <Search className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
        <input
          autoFocus
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder="Team number or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ color: "var(--text)" }}
        />
        {loading && <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />}
      </div>
      {searchError && (
        <p className="text-center py-8 text-sm" style={{ color: "var(--danger)" }}>Search error — please try again</p>
      )}
      {!searchError && results.length > 0 && (
        <div className="space-y-2">
          {results.map((t) => (
            <Link key={t.teamNumber} href={`/teams/${t.teamNumber}`}
              className="flex items-center justify-between px-4 py-4 rounded-xl glass hover:bg-white/5 transition-colors">
              <div>
                <span className="font-bold">{t.teamNumber}</span>
                <span className="ml-3 text-sm" style={{ color: "var(--text-muted)" }}>{t.nameShort}</span>
              </div>
              <span className="text-sm hidden sm:block" style={{ color: "var(--text-muted)" }}>{t.city}, {t.stateProv} · {t.country}</span>
            </Link>
          ))}
        </div>
      )}
      {!loading && !searchError && query && results.length === 0 && (
        <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>No teams found for &quot;{query}&quot;</p>
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
