"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { useI18n } from "@/context/LanguageContext";

export default function TeamNotFound({
  teamNum,
  upstreamUnavailable,
  upstreamMessage,
}: {
  teamNum: number;
  upstreamUnavailable?: boolean;
  upstreamMessage?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/"
        className="inline-flex items-center gap-2 text-sm mb-6 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
        style={{ color: "var(--text-muted)" }}>
        <Home className="w-4 h-4" />
        {t.teamDetail.back}
      </Link>
      {upstreamUnavailable ? (
        <p style={{ color: "var(--warning)" }}>
          {upstreamMessage ?? "Scouting data is temporarily unavailable. Please try again shortly."}
        </p>
      ) : (
        <p style={{ color: "var(--danger)" }}>
          {t.teamDetail.notFound.replace("{num}", String(teamNum))}
        </p>
      )}
    </div>
  );
}
