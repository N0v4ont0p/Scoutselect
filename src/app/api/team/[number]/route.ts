import { NextRequest, NextResponse } from "next/server";
import { getTeam, upstreamErrorMessage } from "@/lib/ftcscout";
import { cacheGet, cacheGetStale, cacheSet, TTL_TEAM } from "@/lib/cache";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const num = parseInt(number, 10);
  const key = `team:${num}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await getTeam(num);
    cacheSet(key, data, TTL_TEAM);
    return NextResponse.json(data);
  } catch (e) {
    console.error(`[api/team/${num}] FTCScout error:`, e);
    const stale = cacheGetStale(key);
    if (stale) return NextResponse.json(stale, { headers: { "X-Cache": "stale" } });
    const msg = e instanceof Error ? e.message : String(e);
    // Distinguish "team not found" (GraphQL null) from upstream failures
    if (msg.startsWith("Team ") && msg.endsWith("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: upstreamErrorMessage(e) }, { status: 503 });
  }
}
