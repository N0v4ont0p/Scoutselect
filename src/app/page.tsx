'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trophy, Target, TrendingUp, Zap, BarChart3, GitBranch, ChevronRight } from 'lucide-react';
import type { TeamSearchResult } from '@/lib/ftcscout';

const CURRENT_SEASON = 2025;
const SEASONS = [2025, 2024, 2023, 2022, 2021];

const FEATURES = [
  {
    icon: Trophy,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    title: 'Alliance Picking',
    desc: 'SAFE / BALANCED / CEILING / COUNTER modes with role fingerprint synergy scoring',
  },
  {
    icon: Target,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10 border-rose-400/20',
    title: 'Getting Picked',
    desc: 'Personalised pitches for each captain with win-probability increase estimates',
  },
  {
    icon: BarChart3,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    title: 'OPR Analytics',
    desc: 'True Offensive Power Ratings via least-squares regression across all qual matches',
  },
  {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
    title: 'Monte Carlo',
    desc: 'Win-probability simulations with Bayesian shrinkage and trend-weighted scoring',
  },
  {
    icon: GitBranch,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 border-purple-400/20',
    title: 'Bracket Coach',
    desc: 'Live playoff bracket tracking with match history and score breakdowns',
  },
];

export default function Home() {
  const router = useRouter();
  const [teamInput, setTeamInput] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [searchResults, setSearchResults] = useState<TeamSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!nameQuery || nameQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search/teams?q=${encodeURIComponent(nameQuery)}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [nameQuery]);

  const handleTeamGo = () => {
    const n = parseInt(teamInput);
    if (!isNaN(n) && n > 0) router.push(`/dashboard?team=${n}&season=${season}`);
  };

  const handleSelectTeam = (team: TeamSearchResult) => {
    router.push(`/dashboard?team=${team.number}&season=${season}`);
  };

  return (
    <main className="min-h-screen bg-background overflow-hidden relative">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/8 blur-3xl animate-float" style={{ animationDuration: '14s' }} />
        <div className="absolute bottom-[-15%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-indigo-700/8 blur-3xl animate-float" style={{ animationDuration: '18s', animationDelay: '4s' }} />
        <div className="absolute top-[40%] left-[60%] w-[30vw] h-[30vw] rounded-full bg-purple-600/5 blur-3xl animate-float" style={{ animationDuration: '22s', animationDelay: '8s' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8 pb-16">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative">
              <Trophy className="h-9 w-9 text-yellow-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight glow-blue">ScoutSelect</h1>
          </div>
          <p className="text-blue-200/80 text-sm leading-relaxed max-w-xs mx-auto">
            Data-first alliance intelligence for FTC teams — OPR, Monte Carlo, and synergy scoring from live match data
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {['OPR Analytics', 'Monte Carlo', 'Live Data', 'FTC 2025-26'].map(tag => (
              <span key={tag} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Season selector */}
        <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <label className="block text-[11px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Season</label>
          <div className="flex gap-2 flex-wrap">
            {SEASONS.map(s => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  season === s
                    ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {s}-{s + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Quick lookup */}
        <div className="glass rounded-2xl p-4 mb-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Team number</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="e.g. 19859"
              value={teamInput}
              onChange={e => setTeamInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTeamGo()}
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <button
              onClick={handleTeamGo}
              disabled={!teamInput || isNaN(parseInt(teamInput))}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_16px_rgba(59,130,246,0.4)]"
            >
              Go <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Name search */}
        <div className="glass rounded-2xl p-4 mb-8 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Search by name</span>
          </div>
          <input
            type="text"
            placeholder="Type team name…"
            value={nameQuery}
            onChange={e => setNameQuery(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          {searchLoading && <p className="text-xs text-muted-foreground mt-2 animate-pulse">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map(t => (
                <button
                  key={t.number}
                  onClick={() => handleSelectTeam(t)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/8 transition-colors flex items-center gap-2"
                >
                  <span className="text-xs font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full">#{t.number}</span>
                  <span className="text-sm text-white font-medium flex-1 truncate">{t.name}</span>
                  {t.city && <span className="text-xs text-muted-foreground flex-shrink-0">{t.city}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feature grid */}
        <div className="space-y-3">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }, i) => (
            <div
              key={title}
              className="glass glass-hover rounded-xl p-3 flex items-start gap-3 animate-fade-in-up"
              style={{ animationDelay: `${200 + i * 60}ms` }}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground/40 text-xs mt-10">
          Powered by FTCScout API · Built by FTC Team 19859
        </p>
      </div>
    </main>
  );
}

