import { NextRequest, NextResponse } from "next/server";
import { getEventTeams, getEventRankings, upstreamErrorMessage } from "@/lib/ftcscout";
import { cacheGet, cacheGetStale, cacheSet, TTL_LIVE } from "@/lib/cache";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season, code } = await params;
  const key = `event-teams:${season}:${code}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const [teams, rankings] = await Promise.all([
      getEventTeams(parseInt(season, 10), code),
      getEventRankings(parseInt(season, 10), code),
    ]);
    const data = { teams, rankings };
    cacheSet(key, data, TTL_LIVE);
    return NextResponse.json(data);
  } catch (e) {
    console.error(`[api/event/${season}/${code}/teams] FTCScout error:`, e);
    const stale = cacheGetStale(key);
    if (stale) return NextResponse.json(stale, { headers: { "X-Cache": "stale" } });
    return NextResponse.json({ error: upstreamErrorMessage(e) }, { status: 503 });
  }
}
