import { NextRequest, NextResponse } from "next/server";
import { getEventTeams, getTeamsBatchSeasonStats } from "@/lib/ftcscout";
import { cacheGet, cacheSet, TTL_TEAM } from "@/lib/cache";

/** Max teams fetched per preview request — keeps response fast and API-friendly. */
const MAX_PREVIEW_TEAMS = 30;

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
    const slice = teamNumbers.slice(0, MAX_PREVIEW_TEAMS);
    const teams = await getTeamsBatchSeasonStats(slice, seasonNum);
    cacheSet(key, teams, TTL_TEAM);
    return NextResponse.json(teams);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
