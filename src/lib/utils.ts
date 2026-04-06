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
