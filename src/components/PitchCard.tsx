import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AlliancePitch } from '@/lib/analytics';

export function PitchCard({ pitch, rank }: { pitch: AlliancePitch; rank: number }) {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Rank #{rank} Alliance</CardTitle>
            <p className="font-semibold">{pitch.captainName || `Team ${pitch.captainTeam}`}</p>
            <p className="text-xs text-muted-foreground">#{pitch.captainTeam}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-blue-500">{pitch.fitScore.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">fit score</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {pitch.winProbabilityIncrease > 0 && (
          <Badge className="bg-green-500 text-white text-xs">
            +{pitch.winProbabilityIncrease.toFixed(1)}% win probability
          </Badge>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Why they need you:</p>
          <ul className="space-y-1">
            {pitch.whyTheyNeedYou.map((w, i) => (
              <li key={i} className="text-xs text-green-600 dark:text-green-400">✓ {w}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Talking points:</p>
          <ul className="space-y-1">
            {pitch.talkingPoints.map((t, i) => (
              <li key={i} className="text-xs">• {t}</li>
            ))}
          </ul>
        </div>
        {pitch.redFlags.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Watch out:</p>
            {pitch.redFlags.map((f, i) => (
              <p key={i} className="text-xs text-red-500">⚠ {f}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
