'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Trophy, Target, TrendingUp, Zap } from 'lucide-react';
import type { TeamSearchResult } from '@/lib/ftcscout';

const CURRENT_SEASON = 2024;
const SEASONS = [2024, 2023, 2022, 2021];

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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Trophy className="h-8 w-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white tracking-tight">ScoutSelect</h1>
          </div>
          <p className="text-blue-200 text-sm leading-relaxed">
            Data-driven alliance selection &amp; scouting intelligence for FTC teams
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            <Badge variant="outline" className="text-blue-300 border-blue-500 text-xs">Monte Carlo Simulation</Badge>
            <Badge variant="outline" className="text-blue-300 border-blue-500 text-xs">Real-time Data</Badge>
            <Badge variant="outline" className="text-blue-300 border-blue-500 text-xs">FTCScout API</Badge>
          </div>
        </div>

        {/* Season selector */}
        <div className="mb-4">
          <label className="block text-xs text-blue-300 mb-1 font-medium uppercase tracking-wide">Season</label>
          <div className="flex gap-2 flex-wrap">
            {SEASONS.map(s => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  season === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s}-{s + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Team number input */}
        <Card className="bg-slate-800/70 border-slate-700 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              Quick lookup by team number
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="e.g. 19859"
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTeamGo()}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={handleTeamGo} className="bg-blue-600 hover:bg-blue-500 text-white px-4">
                Go
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Name search */}
        <Card className="bg-slate-800/70 border-slate-700 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-400" />
              Search by team name
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              placeholder="Type team name..."
              value={nameQuery}
              onChange={e => setNameQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchLoading && <p className="text-xs text-slate-400 mt-2">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {searchResults.map(t => (
                  <button
                    key={t.number}
                    onClick={() => handleSelectTeam(t)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <span className="text-white text-sm font-medium">#{t.number}</span>
                    <span className="text-slate-300 text-sm ml-2">{t.name}</span>
                    {t.city && <span className="text-slate-500 text-xs ml-2">{t.city}, {t.state}</span>}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <Separator className="bg-slate-700 mb-6" />
        <div className="grid grid-cols-1 gap-3">
          {[
            { icon: Trophy, color: 'text-yellow-400', title: 'Alliance Picking', desc: 'SAFE / BALANCED / CEILING / COUNTER modes with synergy scoring' },
            { icon: Target, color: 'text-red-400', title: 'Getting Picked', desc: 'Personalized pitches for each potential captain alliance' },
            { icon: TrendingUp, color: 'text-green-400', title: 'Match Analytics', desc: 'Expected scores, reliability index, and performance trends' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-3 px-1">
              <Icon className={`h-5 w-5 ${color} mt-0.5 flex-shrink-0`} />
              <div>
                <p className="text-white font-medium text-sm">{title}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          Powered by FTCScout API • Made by FTC Team 19859
        </p>
      </div>
    </main>
  );
}
