"use client";
import Link from "next/link";
import { Home } from "lucide-react";
import { seasonName } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

export default function SeasonsPage() {
  const { t } = useI18n();
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      <Link href="/"
        className="inline-flex items-center gap-2 text-sm mb-8 px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/5"
        style={{ color: "var(--text-muted)" }}>
        <Home className="w-4 h-4" />
        {t.teams.back}
      </Link>
      <h1 className="text-3xl font-black mb-8 animate-slide-up">{t.seasons.title}</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {SEASONS.slice().reverse().map((s, i) => (
          <Link key={s} href={`/seasons/${s}`}
            className="glass glass-hover rounded-2xl p-5 animate-fade-in"
            style={{ animationDelay: `${i * 0.05}s`, opacity: 0, animationFillMode: "forwards", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-black mb-1">{s}–{s + 1}</div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>{seasonName(s)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

