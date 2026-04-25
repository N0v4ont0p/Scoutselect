import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/ftcscout";
import { cacheGet, cacheSet, TTL_TEAM } from "@/lib/cache";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ season: string; code: string }> }) {
  const { season, code } = await params;
  const key = `event:${season}:${code}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await getEvent(parseInt(season, 10), code);
    cacheSet(key, data, TTL_TEAM);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
