import { NextRequest, NextResponse } from 'next/server';
import { getTeamEvents } from '@/lib/ftcscout';
import { withCache, TTL } from '@/lib/cache';

export async function GET(req: NextRequest, { params }: { params: Promise<{ teamNumber: string }> }) {
  const { teamNumber: teamNumberStr } = await params;
  const teamNumber = parseInt(teamNumberStr);
  const season = parseInt(req.nextUrl.searchParams.get('season') ?? '2024');
  if (isNaN(teamNumber)) return NextResponse.json({ error: 'Invalid team number' }, { status: 400 });
  try {
    const events = await withCache(`team:${teamNumber}:events:${season}`, TTL.TEAM_DATA, () => getTeamEvents(teamNumber, season));
    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
