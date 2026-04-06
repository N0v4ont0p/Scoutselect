import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { seasonName } from "@/lib/utils";

export default async function SeasonPage({ params }: { params: Promise<{ season: string }> }) {
  const { season } = await params;
  const s = parseInt(season, 10);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/seasons" className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Seasons
      </Link>
      <h1 className="text-3xl font-black mb-2">{seasonName(s)}</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>{s}–{s + 1} FTC Season</p>
      <div className="glass rounded-2xl p-6">
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Enter an event code to open the analytics dashboard for a {seasonName(s)} event.
        </p>
        <Link href={`/events`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm"
          style={{ background: "var(--accent)", color: "#fff" }}>
          Open Event Lookup
        </Link>
      </div>
    </div>
  );
}
