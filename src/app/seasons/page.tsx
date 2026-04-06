"use client";
import Link from "next/link";
import { Globe } from "lucide-react";
import { seasonName } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

export default function SeasonsPage() {
  const { t, toggle } = useI18n();
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black animate-slide-up">{t.seasons.title}</h1>
        <button onClick={toggle} className="lang-btn flex items-center gap-1.5">
          <Globe className="w-3 h-3" />
          {t.nav.toggleLang}
        </button>
      </div>
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

