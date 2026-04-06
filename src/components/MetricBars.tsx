'use client';

interface MetricBarsProps {
  auto: number;
  teleop: number;
  endgame: number;
  maxScore?: number;
  animDelay?: number;
}

function Bar({
  label,
  value,
  max,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  delay?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full score-bar-inner"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            animationDelay: `${delay}ms`,
            boxShadow: `0 0 8px ${color}55`,
          }}
        />
      </div>
    </div>
  );
}

export function MetricBars({ auto, teleop, endgame, maxScore = 200, animDelay = 0 }: MetricBarsProps) {
  return (
    <div className="space-y-2">
      <Bar label="Auto"    value={auto}    max={maxScore} color="#3b82f6" delay={animDelay} />
      <Bar label="TeleOp"  value={teleop}  max={maxScore} color="#10b981" delay={animDelay + 80} />
      <Bar label="Endgame" value={endgame} max={maxScore} color="#a855f7" delay={animDelay + 160} />
    </div>
  );
}

