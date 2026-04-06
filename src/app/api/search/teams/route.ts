import { NextRequest, NextResponse } from "next/server";
import { searchTeams } from "@/lib/ftcscout";
import { cacheGet, cacheSet, TTL_SEARCH } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);
  const key = `search:${q}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await searchTeams(q);
    cacheSet(key, data, TTL_SEARCH);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
