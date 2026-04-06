'use client';
import type { AlliancePitch } from '@/lib/analytics';

function WinRing({ pct }: { pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={52} height={52} className="flex-shrink-0" aria-label={`Win probability boost: ${pct.toFixed(0)}%`}>
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle
        cx={26} cy={26} r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
        strokeDashoffset={(circ / 4).toFixed(1)}
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={26} y={26} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold" fill="#10b981">
        +{pct.toFixed(0)}%
      </text>
    </svg>
  );
}

function FitBar({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#6366f1';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color, transition: 'width 0.8s ease' }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{score.toFixed(0)}</span>
    </div>
  );
}

export function PitchCard({ pitch, rank, delay = 0 }: { pitch: AlliancePitch; rank: number; delay?: number }) {
  const hasWinBoost = pitch.winProbabilityIncrease > 2;

  return (
    <div
      className="glass glass-hover rounded-xl overflow-hidden animate-fade-in-up card-accent-green"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              Rank #{pitch.captainRank ?? rank}
            </span>
          </div>
          <p className="font-bold text-base text-white truncate">{pitch.captainName || `Team ${pitch.captainTeam}`}</p>
          <p className="text-[11px] text-muted-foreground">#{pitch.captainTeam}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasWinBoost && <WinRing pct={Math.min(99, pitch.winProbabilityIncrease)} />}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Fit score</p>
            <p className="text-sm font-bold text-blue-400">{pitch.fitScore.toFixed(0)}/100</p>
          </div>
        </div>
      </div>

      {/* Fit bar */}
      <div className="px-4 pb-2">
        <FitBar score={pitch.fitScore} />
      </div>

      {/* Confidence */}
      <div className="px-4 pb-3 border-t border-white/5 pt-2 space-y-2">
        {/* Why they need you */}
        {pitch.whyTheyNeedYou.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Why they need you</p>
            <div className="space-y-1">
              {pitch.whyTheyNeedYou.map((w, i) => (
                <p key={i} className="text-xs text-emerald-400 flex items-start gap-1">
                  <span className="flex-shrink-0 mt-px">✓</span>
                  {w}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Talking points */}
        {pitch.talkingPoints.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Talking points</p>
            <div className="space-y-1">
              {pitch.talkingPoints.map((t, i) => (
                <p key={i} className="text-xs text-slate-300 flex items-start gap-1">
                  <span className="text-blue-400 flex-shrink-0 mt-px">›</span>
                  {t}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Red flags */}
        {pitch.redFlags.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Address proactively</p>
            <div className="space-y-1">
              {pitch.redFlags.map((f, i) => (
                <p key={i} className="text-xs text-rose-400 flex items-start gap-1">
                  <span className="flex-shrink-0 mt-px">⚠</span>
                  {f}
                </p>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground pt-1">
          Confidence: {pitch.confidence.toFixed(0)}% · Synergy: {pitch.synergy?.synergyScore?.toFixed(1) ?? '—'}
        </p>
      </div>
    </div>
  );
}

