import type { Team } from '@/lib/ftcscout';
import { MapPin, Calendar, Building2 } from 'lucide-react';

export function TeamCard({ team }: { team: Team }) {
  return (
    <div className="glass rounded-xl p-4 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full tabular-nums">
              #{team.number}
            </span>
            {team.rookieYear && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Since {team.rookieYear}
              </span>
            )}
          </div>
          <h2 className="font-bold text-lg text-white leading-tight truncate">{team.name}</h2>
          {team.schoolName && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{team.schoolName}</span>
            </p>
          )}
          {(team.city || team.state) && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {[team.city, team.state, team.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

