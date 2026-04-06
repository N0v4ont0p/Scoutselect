import { NextRequest, NextResponse } from 'next/server';
import { searchTeams } from '@/lib/ftcscout';
import { withCache, TTL } from '@/lib/cache';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? '';
  if (!query) return NextResponse.json([]);
  try {
    const results = await withCache(`search:teams:${query}`, TTL.SEARCH, () => searchTeams(query));
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
