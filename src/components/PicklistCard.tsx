import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetricBars } from './MetricBars';
import type { PickRecommendation } from '@/lib/analytics';

function ReliabilityBadge({ index }: { index: number }) {
  if (index >= 70) return <Badge className="bg-green-500 text-white text-xs">Reliable</Badge>;
  if (index >= 40) return <Badge className="bg-yellow-500 text-white text-xs">Variable</Badge>;
  return <Badge className="bg-red-500 text-white text-xs">Inconsistent</Badge>;
}

export function PicklistCard({ pick, position }: { pick: PickRecommendation; position: number }) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">#{position}</span>
            <div>
              <p className="font-semibold text-sm">{pick.teamName || `Team ${pick.teamNumber}`}</p>
              <p className="text-xs text-muted-foreground">#{pick.teamNumber}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{pick.metrics.totalExpected.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">avg pts</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div className="flex flex-wrap gap-1">
          <ReliabilityBadge index={pick.metrics.reliabilityIndex} />
          {pick.metrics.trend > 5 && <Badge variant="outline" className="text-xs text-green-600">↑ Trending</Badge>}
          {pick.metrics.matchCount < 3 && <Badge variant="outline" className="text-xs text-yellow-600">Low data</Badge>}
        </div>
        <MetricBars
          auto={pick.metrics.expectedAuto}
          teleop={pick.metrics.expectedTeleop}
          endgame={pick.metrics.expectedEndgame}
        />
        {pick.factors.length > 0 && (
          <div className="space-y-1">
            {pick.factors.map((f, i) => (
              <p key={i} className="text-xs text-green-600 dark:text-green-400">✓ {f}</p>
            ))}
          </div>
        )}
        {pick.warnings.length > 0 && (
          <div className="space-y-1">
            {pick.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">⚠ {w}</p>
            ))}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Synergy: {pick.synergyScore.synergyScore.toFixed(1)} • Confidence: {pick.confidence.toFixed(0)}%
        </div>
      </CardContent>
    </Card>
  );
}
