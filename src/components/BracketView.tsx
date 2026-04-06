'use client';
import type { Match } from '@/lib/ftcscout';

interface BracketViewProps {
  matches: Match[];
}

export function BracketView({ matches }: BracketViewProps) {
  const playoffs = matches.filter(m =>
    ['PLAYOFF', 'SEMIFINAL', 'FINAL'].includes(m.tournamentLevel) && m.played
  );

  if (playoffs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No playoff matches yet</p>;
  }

  return (
    <div className="space-y-3">
      {playoffs.map(match => {
        const red = match.teams.filter(t => t.alliance === 'Red').map(t => t.teamNumber);
        const blue = match.teams.filter(t => t.alliance === 'Blue').map(t => t.teamNumber);
        const redScore = match.scores?.red?.totalPoints ?? 0;
        const blueScore = match.scores?.blue?.totalPoints ?? 0;
        const redWon = match.winner === 'Red';
        return (
          <div key={match.id} className="border rounded-lg overflow-hidden">
            <div className="text-xs text-center py-1 bg-muted text-muted-foreground font-medium">
              {match.tournamentLevel} Match {match.matchNum}
            </div>
            <div className={`flex items-center justify-between px-3 py-2 ${redWon ? 'bg-red-50 dark:bg-red-950' : ''}`}>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs">{red.join(', ')}</span>
              </div>
              <span className={`font-bold text-sm ${redWon ? 'text-red-600' : ''}`}>{redScore}</span>
            </div>
            <div className={`flex items-center justify-between px-3 py-2 ${!redWon ? 'bg-blue-50 dark:bg-blue-950' : ''}`}>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs">{blue.join(', ')}</span>
              </div>
              <span className={`font-bold text-sm ${!redWon ? 'text-blue-600' : ''}`}>{blueScore}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
