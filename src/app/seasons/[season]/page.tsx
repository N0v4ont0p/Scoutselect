"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { seasonName } from "@/lib/utils";
import { useI18n } from "@/context/LanguageContext";

export default function SeasonPage() {
  const { t } = useI18n();
  const params = useParams();
  const s = parseInt(params.season as string, 10);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      <Link href="/seasons"
        className="inline-flex items-center gap-2 text-sm mb-6 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
        style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" />
        {t.seasonDetail.back}
      </Link>
      <h1 className="text-3xl font-black mb-1 animate-slide-up">{seasonName(s)}</h1>
      <p className="text-sm mb-8 animate-slide-up stagger-1" style={{ color: "var(--text-muted)" }}>
        {t.seasonDetail.subtitle.replace("{start}", String(s)).replace("{end}", String(s + 1))}
      </p>
      <div className="glass rounded-2xl p-6 animate-slide-up stagger-2" style={{ border: "1px solid var(--border)" }}>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          {t.seasonDetail.enterCode.replace("{name}", seasonName(s))}
        </p>
        <Link href="/events"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:brightness-110"
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
          {t.seasonDetail.openLookup}
        </Link>
      </div>
    </div>
  );
}

