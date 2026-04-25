import { NextRequest, NextResponse } from "next/server";
import { getSeasonEvents, upstreamErrorMessage, type FTCEventSummary } from "@/lib/ftcscout";
import { getCurrentSeason } from "@/lib/utils";
import { cacheGet, cacheGetStale, cacheSet, TTL_SEARCH } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const season = parseInt(
    req.nextUrl.searchParams.get("season") ?? String(getCurrentSeason()),
    10
  );
  if (!q) return NextResponse.json([]);

  const key = `events:all:${season}`;
  let events = cacheGet<FTCEventSummary[]>(key);
  if (!events) {
    try {
      events = await getSeasonEvents(season);
      cacheSet(key, events, TTL_SEARCH);
    } catch (e) {
      console.error("[api/events/search] FTCScout error:", e);
      const stale = cacheGetStale<FTCEventSummary[]>(key);
      if (stale) {
        events = stale;
      } else {
        return NextResponse.json({ error: upstreamErrorMessage(e) }, { status: 503 });
      }
    }
  }

  const filtered = events
    .filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q) ||
        e.stateProv.toLowerCase().includes(q)
    )
    .slice(0, 20);
  return NextResponse.json(filtered);
}
