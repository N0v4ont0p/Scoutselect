import { NextRequest, NextResponse } from "next/server";
import { getEventTeams, getTeamsBatchSeasonStats, upstreamErrorMessage } from "@/lib/ftcscout";
import { cacheGet, cacheGetStale, cacheSet, TTL_TEAM } from "@/lib/cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ season: string; code: string }> }
) {
  const { season, code } = await params;
  const key = `preview:${season}:${code}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);

  try {
    const seasonNum = parseInt(season, 10);
    const teamNumbers = await getEventTeams(seasonNum, code);
    const teams = await getTeamsBatchSeasonStats(teamNumbers, seasonNum);
    cacheSet(key, teams, TTL_TEAM);
    return NextResponse.json(teams);
  } catch (e) {
    console.error(`[api/event/${season}/${code}/preview] FTCScout error:`, e);
    const stale = cacheGetStale(key);
    if (stale) return NextResponse.json(stale, { headers: { "X-Cache": "stale" } });
    return NextResponse.json({ error: upstreamErrorMessage(e) }, { status: 503 });
  }
}
