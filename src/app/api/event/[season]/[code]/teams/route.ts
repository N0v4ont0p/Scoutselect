import { NextRequest, NextResponse } from 'next/server';
import { getEventTeams } from '@/lib/ftcscout';
import { withCache, TTL } from '@/lib/cache';

export async function GET(req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season: seasonStr, code } = await params;
  const season = parseInt(seasonStr);
  const isCompleted = req.nextUrl.searchParams.get('completed') === 'true';
  const ttl = isCompleted ? TTL.COMPLETED_EVENT : TTL.LIVE_EVENT;
  try {
    const teams = await withCache(`event:${season}:${code}:teams`, ttl, () => getEventTeams(season, code));
    return NextResponse.json(teams);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
