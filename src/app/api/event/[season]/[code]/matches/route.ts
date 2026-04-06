import { NextRequest, NextResponse } from "next/server";
import { getEventMatches } from "@/lib/ftcscout";
import { cacheGet, cacheSet, TTL_LIVE } from "@/lib/cache";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season, code } = await params;
  const key = `matches:${season}:${code}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await getEventMatches(parseInt(season, 10), code);
    cacheSet(key, data, TTL_LIVE);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
