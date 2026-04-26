import { NextRequest, NextResponse } from "next/server";
import { getEvent, upstreamErrorMessage } from "@/lib/ftcscout";
import { cacheGet, cacheGetStale, cacheSet, TTL_TEAM } from "@/lib/cache";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season, code } = await params;
  const key = `event:${season}:${code}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await getEvent(parseInt(season, 10), code);
    cacheSet(key, data, TTL_TEAM);
    return NextResponse.json(data);
  } catch (e) {
    console.error(`[api/event/${season}/${code}] FTCScout error:`, e);
    const stale = cacheGetStale(key);
    if (stale) return NextResponse.json(stale, { headers: { "X-Cache": "stale" } });
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("Event ") && msg.endsWith("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: upstreamErrorMessage(e) }, { status: 503 });
  }
}
