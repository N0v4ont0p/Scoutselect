import { NextRequest, NextResponse } from 'next/server';
import { getTeam } from '@/lib/ftcscout';
import { withCache, TTL } from '@/lib/cache';

export async function GET(_req: NextRequest, { params }: { params: { teamNumber: string } }) {
  const teamNumber = parseInt(params.teamNumber);
  if (isNaN(teamNumber)) return NextResponse.json({ error: 'Invalid team number' }, { status: 400 });
  try {
    const team = await withCache(`team:${teamNumber}`, TTL.TEAM_DATA, () => getTeam(teamNumber));
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    return NextResponse.json(team);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}
