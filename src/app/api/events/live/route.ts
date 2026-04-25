import { NextResponse } from "next/server";
import { getSeasonEvents, upstreamErrorMessage } from "@/lib/ftcscout";
import { getCurrentSeason } from "@/lib/utils";
import { cacheGet, cacheGetStale, cacheSet, TTL_LIVE } from "@/lib/cache";

export async function GET() {
  const season = getCurrentSeason();
  const key = `events:live:${season}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const events = await getSeasonEvents(season);
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const live = events.filter((e) => e.ongoing);
    const upcoming = events
      .filter((e) => !e.ongoing && !e.finished)
      .filter((e) => {
        const start = new Date(e.start);
        return start >= now && start <= in14Days;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 12);
    const result = { live, upcoming, season };
    cacheSet(key, result, TTL_LIVE);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/events/live] FTCScout error:", e);
    const stale = cacheGetStale<{ live: unknown[]; upcoming: unknown[]; season: number }>(key);
    if (stale) return NextResponse.json(stale, { headers: { "X-Cache": "stale" } });
    return NextResponse.json(
      { live: [], upcoming: [], season, error: upstreamErrorMessage(e) },
      { status: 503 }
    );
  }
}
