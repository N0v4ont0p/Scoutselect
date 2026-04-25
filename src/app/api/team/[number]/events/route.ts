import { NextRequest, NextResponse } from "next/server";
import { getTeamEvents } from "@/lib/ftcscout";
import { getCurrentSeason } from "@/lib/utils";
import { cacheGet, cacheSet, TTL_TEAM } from "@/lib/cache";

export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const defaultSeason = getCurrentSeason();
  const season = parseInt(req.nextUrl.searchParams.get("season") ?? String(defaultSeason), 10);
  const key = `team:${number}:events:${season}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await getTeamEvents(parseInt(number, 10), season);
    cacheSet(key, data, TTL_TEAM);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
