import Link from "next/link";
import { seasonName } from "@/lib/utils";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

export default function SeasonsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black mb-8">Seasons</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {SEASONS.slice().reverse().map((s) => (
          <Link key={s} href={`/seasons/${s}`}
            className="glass rounded-xl p-5 hover:bg-white/5 transition-colors">
            <div className="text-2xl font-black mb-1">{s}–{s + 1}</div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>{seasonName(s)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
