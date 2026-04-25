import { NextRequest, NextResponse } from "next/server";
import { searchTeams } from "@/lib/ftcscout";
import { cacheGet, cacheSet, TTL_SEARCH } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().toLowerCase().slice(0, 100); // normalize + length cap
  if (!q) return NextResponse.json([]);
  const key = `search:${q}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json(cached);
  try {
    const data = await searchTeams(q);
    cacheSet(key, data, TTL_SEARCH);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
