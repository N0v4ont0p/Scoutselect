'use client';
import { Progress } from '@/components/ui/progress';

interface MetricBarsProps {
  auto: number;
  teleop: number;
  endgame: number;
  maxScore?: number;
}

export function MetricBars({ auto, teleop, endgame, maxScore = 200 }: MetricBarsProps) {
  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Auto</span>
          <span className="font-medium">{auto.toFixed(1)}</span>
        </div>
        <Progress value={(auto / maxScore) * 100} className="h-2 [&>div]:bg-blue-500" />
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">TeleOp</span>
          <span className="font-medium">{teleop.toFixed(1)}</span>
        </div>
        <Progress value={(teleop / maxScore) * 100} className="h-2 [&>div]:bg-green-500" />
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Endgame</span>
          <span className="font-medium">{endgame.toFixed(1)}</span>
        </div>
        <Progress value={(endgame / maxScore) * 100} className="h-2 [&>div]:bg-purple-500" />
      </div>
    </div>
  );
}
