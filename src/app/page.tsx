'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, Trophy } from 'lucide-react';
import type { TeamSearchResult } from '@/lib/ftcscout';

const CURRENT_SEASON = 2025;
const SEASONS = [2025, 2024, 2023, 2022, 2021];

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [teamInput, setTeamInput] = useState('');
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [showSearch, setShowSearch] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TeamSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!nameQuery || nameQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/search/teams?q=${encodeURIComponent(nameQuery)}`);
        const d = await r.json();
        setSearchResults(Array.isArray(d) ? d : []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 320);
    return () => clearTimeout(t);
  }, [nameQuery]);

  const go = (n: number) => {
    if (!n || n <= 0) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    router.push(`/dashboard?team=${n}&season=${season}`);
  };

  const handleSubmit = () => go(parseInt(teamInput));

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 pb-12 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-[-20%] left-[-15%] w-[70vw] h-[70vw] rounded-full bg-blue-700/7 blur-3xl animate-float" style={{ animationDuration: '16s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-indigo-700/7 blur-3xl animate-float" style={{ animationDuration: '21s', animationDelay: '5s' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mb-4 shadow-[0_0_32px_rgba(59,130,246,0.4)]">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">ScoutSelect</h1>
          <p className="text-sm text-slate-400 mt-1">Alliance intelligence for FTC teams</p>
        </div>

        {/* Main input card */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Your team number
            </label>
            <div className={`flex gap-2 ${shake ? 'animate-[wiggle_0.4s_ease]' : ''}`}>
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                placeholder="e.g. 19859"
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-slate-100 text-xl font-bold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                onClick={handleSubmit}
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white transition-all duration-150 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                aria-label="Analyse"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Season chips */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Season</label>
            <div className="flex gap-1.5 flex-wrap">
              {SEASONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    season === s
                      ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.35)]'
                      : 'bg-white/6 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s}–{s + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Name search toggle */}
          <div className="pt-1 border-t border-white/6">
            <button
              onClick={() => setShowSearch(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
            >
              <Search className="h-3 w-3" />
              {showSearch ? 'Hide name search' : 'Find team by name instead'}
            </button>

            {showSearch && (
              <div className="mt-3 space-y-2 animate-fade-in">
                <input
                  type="text"
                  placeholder="Type team name…"
                  value={nameQuery}
                  onChange={e => setNameQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                {searching && <p className="text-xs text-muted-foreground animate-pulse">Searching…</p>}
                {searchResults.map(t => (
                  <button
                    key={t.number}
                    onClick={() => go(t.number)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <span className="text-[11px] font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                      #{t.number}
                    </span>
                    <span className="text-sm text-white font-medium flex-1 truncate">{t.name}</span>
                    {t.city && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 truncate max-w-[80px]">{t.city}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Powered by FTCScout API · FTC Team 19859
        </p>
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}
