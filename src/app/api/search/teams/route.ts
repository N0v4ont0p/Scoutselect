import { NextRequest, NextResponse } from "next/server";
import { searchTeams, upstreamErrorMessage } from "@/lib/ftcscout";
import { cacheGet, cacheGetStale, cacheSet, TTL_SEARCH } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().toLowerCase().slice(0, 100); // normalize + length cap
  if (!q) return NextResponse.json([]);
  const key = `search:${q}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await searchTeams(q);
    cacheSet(key, data, TTL_SEARCH);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/search/teams] FTCScout error:", e);
    const stale = cacheGetStale(key);
    if (stale) return NextResponse.json(stale, { headers: { "X-Cache": "stale" } });
    return NextResponse.json({ error: upstreamErrorMessage(e) }, { status: 503 });
  }
}
