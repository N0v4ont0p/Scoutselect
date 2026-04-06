'use client';
import { MetricBars } from './MetricBars';
import { SparkLine } from './SparkLine';
import type { PickRecommendation } from '@/lib/analytics';

function ReliabilityBadge({ index }: { index: number }) {
  if (index >= 70) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">Reliable</span>;
  if (index >= 40) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">Variable</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">Inconsistent</span>;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, value);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

export function PicklistCard({ pick, position, delay = 0 }: { pick: PickRecommendation; position: number; delay?: number }) {
  const m = pick.metrics;
  const trendPositive = m.trend > 0;

  return (
    <div
      className="glass glass-hover rounded-xl overflow-hidden animate-fade-in-up card-accent-blue"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-sm font-black text-blue-400">#{position}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-white truncate">{m.teamName || `Team ${m.teamNumber}`}</p>
            <p className="text-[11px] text-muted-foreground">#{m.teamNumber} · {m.matchCount} match{m.matchCount !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        {/* Right side: score + sparkline */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div className="text-right">
            <p className="text-xl font-black tabular-nums text-white">{m.totalExpected.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">avg pts</p>
          </div>
          {m.recentScores && m.recentScores.length >= 2 && (
            <SparkLine scores={m.recentScores} width={72} height={24} />
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5 items-center">
        <ReliabilityBadge index={m.reliabilityIndex} />
        {trendPositive && m.trend > 3 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400">
            ↑ +{m.trend.toFixed(1)} trend
          </span>
        )}
        {!trendPositive && m.trend < -5 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
            ↓ {m.trend.toFixed(1)} trend
          </span>
        )}
        {m.matchCount < 3 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
            ⚠ Low data
          </span>
        )}
        {pick.winProbability !== undefined && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 ml-auto">
            {(pick.winProbability * 100).toFixed(0)}% win est.
          </span>
        )}
      </div>

      {/* Metric bars */}
      <div className="px-4 pb-3">
        <MetricBars
          auto={m.expectedAuto}
          teleop={m.expectedTeleop}
          endgame={m.expectedEndgame}
          animDelay={delay + 200}
        />
      </div>

      {/* Synergy + factors */}
      <div className="px-4 pb-3 border-t border-white/5 pt-2 space-y-1.5">
        {pick.factors.map((f, i) => (
          <p key={i} className="text-xs text-emerald-400 flex items-start gap-1">
            <span className="mt-px flex-shrink-0">✓</span>
            {f}
          </p>
        ))}
        {pick.warnings.map((w, i) => (
          <p key={i} className="text-xs text-amber-400 flex items-start gap-1">
            <span className="mt-px flex-shrink-0">⚠</span>
            {w}
          </p>
        ))}
        <div className="pt-1">
          <p className="text-[10px] text-muted-foreground mb-0.5">Confidence</p>
          <ConfidenceBar value={pick.confidence} />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Synergy {pick.synergyScore.synergyScore.toFixed(1)} · Complementarity {pick.synergyScore.complementarity.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

