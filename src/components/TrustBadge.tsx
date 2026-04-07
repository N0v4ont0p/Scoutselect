"use client";

import { AlertTriangle } from "lucide-react";
import type { TeamMetrics } from "@/lib/analytics";
import { useI18n } from "@/context/LanguageContext";

interface TrustBadgeProps {
  metrics: TeamMetrics;
  /** Show scoreStd alongside count (default: true) */
  showStd?: boolean;
}

/**
 * Compact trust/reliability badge for a team's metrics.
 * Shows sample size (n=X), LOW DATA warning when < 5 matches,
 * score std-dev, and any warning messages as a tooltip icon.
 */
export function TrustBadge({ metrics, showStd = true }: TrustBadgeProps) {
  const { t } = useI18n();
  const tr = t.trust;
  const isLowData = metrics.matchCount < 5;

  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      {/* Sample count pill */}
      <span
        className="px-1.5 py-0.5 rounded font-mono"
        style={{
          background: "var(--surface-2)",
          color: isLowData ? "var(--warning)" : "var(--text-muted)",
          border: isLowData ? "1px solid rgba(245,158,11,0.3)" : "1px solid transparent",
        }}
      >
        {tr.sampleSize.replace("{n}", String(metrics.matchCount))}
      </span>

      {/* LOW DATA badge */}
      {isLowData && (
        <span
          className="px-1.5 py-0.5 rounded font-bold tracking-wide"
          style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}
        >
          {tr.lowData}
        </span>
      )}

      {/* Std-dev */}
      {showStd && metrics.scoreStd > 0 && (
        <span style={{ color: "var(--text-muted)" }}>
          {tr.stdDev.replace("{n}", metrics.scoreStd.toFixed(1))}
        </span>
      )}

      {/* Warning icon — tooltip via title */}
      {metrics.warnings.length > 0 && (
        <span title={metrics.warnings.join(" · ")} className="cursor-help leading-none">
          <AlertTriangle
            className="w-3 h-3"
            style={{ color: "var(--warning)" }}
          />
        </span>
      )}
    </span>
  );
}
