"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft } from "lucide-react";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

export default function EventsPage() {
  const router = useRouter();
  const [season, setSeason] = useState(2024);
  const [code, setCode] = useState("");

  function handleGo() {
    if (code.trim()) router.push(`/events/${season}/${code.trim().toUpperCase()}`);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-3xl font-black mb-2">Event Lookup</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        Enter an FTCScout event code (e.g. <code>USMDCMPF1</code>) to open the analytics dashboard.
      </p>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>Season</label>
          <select
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}>
            {SEASONS.slice().reverse().map((s) => (
              <option key={s} value={s}>{s}–{s + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>Event Code</label>
          <input
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
            placeholder="e.g. USMDCMPF1"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGo()}
          />
        </div>
        <button
          onClick={handleGo}
          disabled={!code.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}>
          <Search className="w-4 h-4" /> Open Dashboard
        </button>
      </div>
    </div>
  );
}
