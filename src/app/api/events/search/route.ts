import { NextRequest, NextResponse } from "next/server";
import { getSeasonEvents, type FTCEventSummary } from "@/lib/ftcscout";
import { getCurrentSeason } from "@/lib/utils";
import { cacheGet, cacheSet, TTL_SEARCH } from "@/lib/cache";

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
      return NextResponse.json({ error: String(e) }, { status: 500 });
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
