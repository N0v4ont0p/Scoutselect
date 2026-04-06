'use client';
import type { Match } from '@/lib/ftcscout';

interface BracketMatchProps {
  match: Match;
}

function BracketMatch({ match }: BracketMatchProps) {
  const red = match.teams.filter(t => t.alliance === 'Red').map(t => t.teamNumber);
  const blue = match.teams.filter(t => t.alliance === 'Blue').map(t => t.teamNumber);
  const redScore = match.scores?.red?.totalPoints ?? 0;
  const blueScore = match.scores?.blue?.totalPoints ?? 0;
  const redWon = match.winner === 'Red';
  const blueWon = match.winner === 'Blue';

  return (
    <div className="glass rounded-xl overflow-hidden w-full border border-white/5 hover:border-white/10 transition-colors">
      <div className="text-[10px] text-center py-1 text-muted-foreground font-semibold bg-white/3 uppercase tracking-wider">
        {match.tournamentLevel} · Match {match.matchNum}
        {match.series > 1 ? ` (Set ${match.series})` : ''}
      </div>

      {/* Red alliance */}
      <div className={`flex items-center justify-between px-3 py-2 ${redWon ? 'bg-red-500/10' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${redWon ? 'bg-red-400 shadow-[0_0_6px_#f87171]' : 'bg-red-500/50'}`} />
          <span className={`text-xs ${redWon ? 'text-white font-bold' : 'text-muted-foreground'}`}>
            {red.length > 0 ? red.join(' · ') : '—'}
          </span>
        </div>
        <span className={`text-sm font-black tabular-nums ${redWon ? 'text-red-400' : 'text-muted-foreground'}`}>
          {match.hasBeenPlayed ? redScore : '—'}
        </span>
      </div>

      {/* Blue alliance */}
      <div className={`flex items-center justify-between px-3 py-2 border-t border-white/5 ${blueWon ? 'bg-blue-500/10' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${blueWon ? 'bg-blue-400 shadow-[0_0_6px_#60a5fa]' : 'bg-blue-500/50'}`} />
          <span className={`text-xs ${blueWon ? 'text-white font-bold' : 'text-muted-foreground'}`}>
            {blue.length > 0 ? blue.join(' · ') : '—'}
          </span>
        </div>
        <span className={`text-sm font-black tabular-nums ${blueWon ? 'text-blue-400' : 'text-muted-foreground'}`}>
          {match.hasBeenPlayed ? blueScore : '—'}
        </span>
      </div>
    </div>
  );
}

interface BracketViewProps {
  matches: Match[];
}

export function BracketView({ matches }: BracketViewProps) {
  const playoffs = matches.filter(m =>
    ['ELIM', 'PLAYOFF', 'SEMIFINAL', 'FINAL', 'ELIMINATION'].includes(m.tournamentLevel)
  );

  if (playoffs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="text-4xl">🏆</div>
        <p className="text-sm text-muted-foreground text-center">No playoff matches yet</p>
        <p className="text-xs text-muted-foreground/60 text-center">Check back after alliance selection</p>
      </div>
    );
  }

  // Group by tournament level: ELIM covers all elimination rounds; SEMIFINAL/PLAYOFF are
  // alternative API level names for semi-final rounds; FINAL is the championship match.
  const semis = playoffs.filter(m => ['ELIM', 'SEMIFINAL', 'PLAYOFF', 'ELIMINATION'].includes(m.tournamentLevel));
  const finals = playoffs.filter(m => m.tournamentLevel === 'FINAL');

  return (
    <div className="space-y-4 animate-fade-in">
      {semis.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Eliminations</p>
          <div className="grid grid-cols-1 gap-3">
            {semis.map(m => <BracketMatch key={m.id} match={m} />)}
          </div>
        </div>
      )}
      {finals.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
            <span>🏆</span> Finals
          </p>
          <div className="space-y-3">
            {finals.map(m => <BracketMatch key={m.id} match={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}

