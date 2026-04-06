'use client';

interface SparkLineProps {
  scores: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
}

export function SparkLine({ scores, width = 80, height = 28, color = '#3b82f6', showDots = true }: SparkLineProps) {
  if (!scores || scores.length < 2) return null;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const pad = 3;

  const pts = scores.map((s, i) => ({
    x: pad + (i / (scores.length - 1)) * (width - pad * 2),
    y: pad + (1 - (s - min) / range) * (height - pad * 2),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Area fill path
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${height} L ${pts[0].x.toFixed(1)} ${height} Z`;

  const lastPt = pts[pts.length - 1];
  const trend = scores[scores.length - 1] - scores[0];
  const dotColor = trend >= 0 ? '#10b981' : '#f43f5e';

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${width}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#sg-${width})`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Latest point dot */}
      {showDots && (
        <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={dotColor} stroke="rgba(15,23,42,0.8)" strokeWidth="1" />
      )}
    </svg>
  );
}
