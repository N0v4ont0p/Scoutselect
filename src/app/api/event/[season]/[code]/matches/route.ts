import { NextRequest, NextResponse } from 'next/server';
import { getEventMatches } from '@/lib/ftcscout';
import { withCache, TTL } from '@/lib/cache';

export async function GET(_req: NextRequest, { params }: { params: { season: string; code: string } }) {
  const season = parseInt(params.season);
  const code = params.code;
  try {
    const matches = await withCache(`event:${season}:${code}:matches`, TTL.LIVE_EVENT, () => getEventMatches(season, code));
    return NextResponse.json(matches);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }
}
