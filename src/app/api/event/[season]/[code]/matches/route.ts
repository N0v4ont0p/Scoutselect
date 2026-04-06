import { NextRequest, NextResponse } from 'next/server';
import { getEventMatches } from '@/lib/ftcscout';
import { withCache, TTL } from '@/lib/cache';

export async function GET(req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season: seasonStr, code } = await params;
  const season = parseInt(seasonStr);
  const isCompleted = req.nextUrl.searchParams.get('completed') === 'true';
  const ttl = isCompleted ? TTL.COMPLETED_EVENT : TTL.LIVE_EVENT;
  try {
    const matches = await withCache(`event:${season}:${code}:matches`, ttl, () => getEventMatches(season, code));
    return NextResponse.json(matches);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}
