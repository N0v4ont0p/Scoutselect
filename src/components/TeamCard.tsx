import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Team } from '@/lib/ftcscout';

export function TeamCard({ team }: { team: Team }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">#{team.number}</CardTitle>
          {team.rookieYear && (
            <Badge variant="outline" className="text-xs">Since {team.rookieYear}</Badge>
          )}
        </div>
        <p className="text-base font-semibold text-foreground">{team.name}</p>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-1">
          {team.schoolName && <p>{team.schoolName}</p>}
          {(team.city || team.state) && (
            <p>{[team.city, team.state, team.country].filter(Boolean).join(', ')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
