export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function seasonName(season: number): string {
  const names: Record<number, string> = {
    2019: "Skystone (2019–20)",
    2020: "Ultimate Goal (2020–21)",
    2021: "Freight Frenzy (2021–22)",
    2022: "Power Play (2022–23)",
    2023: "Centerstage (2023–24)",
    2024: "Into the Deep (2024–25)",
    2025: "Decoded (2025–26)",
  };
  return names[season] ?? `Season ${season}`;
}

/**
 * Returns the current FTC season year.
 * The FTC season starts in September each year (month index 8).
 * e.g. September 2025 → season 2025 (Decoded 2025-26)
 *      April 2026     → season 2025 (Decoded 2025-26)
 */
export function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed; January=0 … August=7, September=8
  return month >= 8 ? year : year - 1;
}

export function formatScore(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function formatPercent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}
