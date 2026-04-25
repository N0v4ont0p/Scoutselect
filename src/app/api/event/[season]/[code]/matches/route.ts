import { NextRequest, NextResponse } from "next/server";
import { getEventMatches, upstreamErrorMessage } from "@/lib/ftcscout";
import { cacheGet, cacheGetStale, cacheSet, TTL_LIVE } from "@/lib/cache";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season, code } = await params;
  const key = `matches:${season}:${code}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await getEventMatches(parseInt(season, 10), code);
    cacheSet(key, data, TTL_LIVE);
    return NextResponse.json(data);
  } catch (e) {
    console.error(`[api/event/${season}/${code}/matches] FTCScout error:`, e);
    const stale = cacheGetStale(key);
    if (stale) return NextResponse.json(stale, { headers: { "X-Cache": "stale" } });
    return NextResponse.json({ error: upstreamErrorMessage(e) }, { status: 503 });
  }
}
