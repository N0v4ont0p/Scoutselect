import { NextRequest, NextResponse } from 'next/server';
import { getEventTeams } from '@/lib/ftcscout';
import { withCache, TTL } from '@/lib/cache';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season: seasonStr, code } = await params;
  const season = parseInt(seasonStr);
  try {
    const teams = await withCache(`event:${season}:${code}:teams`, TTL.LIVE_EVENT, () => getEventTeams(season, code));
    return NextResponse.json(teams);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
