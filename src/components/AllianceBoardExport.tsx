"use client";

import { useState, useEffect, useCallback } from "react";
import { Printer, Download, X, Pin } from "lucide-react";
import type { TeamMetrics, DraftAwarePickOption, AllianceMatchup } from "@/lib/analytics";
import {
  getPinnedTeams, togglePinnedTeam,
  getScoutingNotes, setScoutingNote,
  type ScoutingNotes,
} from "@/lib/localStorage";
import { useI18n } from "@/context/LanguageContext";
import { TrustBadge } from "./TrustBadge";
import { seasonName } from "@/lib/utils";

interface AllianceBoardExportProps {
  season: number;
  code: string;
  eventName: string;
  myMetrics: TeamMetrics;
  picks: DraftAwarePickOption[];
  matchups: AllianceMatchup[];
  allMetrics: TeamMetrics[];
  onClose: () => void;
}

export function AllianceBoardExport({
  season, code, eventName, myMetrics, picks, matchups, allMetrics, onClose,
}: AllianceBoardExportProps) {
  const { t } = useI18n();
  const ex = t.export;

  const [pinnedTeams, setPinnedTeams] = useState<number[]>([]);
  const [notes, setNotes] = useState<ScoutingNotes>({});
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState("");

  // Load persisted state on mount (client-only)
  useEffect(() => {
    setPinnedTeams(getPinnedTeams(season, code));
    setNotes(getScoutingNotes(season, code));
  }, [season, code]);

  const handleTogglePin = useCallback((teamNumber: number) => {
    const next = togglePinnedTeam(season, code, teamNumber);
    setPinnedTeams(next);
  }, [season, code]);

  const handleSaveNote = useCallback((teamNumber: number) => {
    const updated = setScoutingNote(season, code, teamNumber, noteInput);
    setNotes(updated);
    setEditingNote(null);
    setNoteInput("");
  }, [season, code, noteInput]);

  const handlePrint = () => window.print();

  const handleDownloadJson = () => {
    const boardData = {
      event: { season, code, name: eventName, seasonName: seasonName(season) },
      generatedAt: new Date().toISOString(),
      myTeam: {
        teamNumber: myMetrics.teamNumber,
        opr: myMetrics.opr,
        reliability: myMetrics.reliability,
        scoreStd: myMetrics.scoreStd,
        matchCount: myMetrics.matchCount,
      },
      topPicks: picks.map((p) => ({
        teamNumber: p.teamNumber,
        allianceStrength: p.allianceStrength,
        availabilityTag: p.availabilityTag,
        sensitivityTag: p.sensitivityTag,
        opr: p.metrics.opr,
        reliability: p.metrics.reliability,
        gapFilledAxis: p.synergy.gapFilledAxis,
        note: notes[p.teamNumber] ?? "",
      })),
      winProbMatchups: matchups.map((m) => ({
        opponentCaptain: m.opponentCaptain,
        winProbability: m.winProbability,
        winProbabilityCI: m.winProbabilityCI,
        strengthDelta: m.strengthDelta,
      })),
      pinnedTeams,
      scoutingNotes: notes,
    };
    const blob = new Blob([JSON.stringify(boardData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scoutselect_${code}_${season}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pinnedMetrics = pinnedTeams
    .map((n) => allMetrics.find((m) => m.teamNumber === n))
    .filter(Boolean) as TeamMetrics[];

  const timestamp = new Date().toLocaleString();

  return (
    <>
      {/* ── Screen overlay ─────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-50 overflow-auto py-8 px-4"
        style={{ background: "rgba(0,0,0,0.75)" }}
      >
        <div
          className="max-w-3xl mx-auto rounded-2xl p-6 space-y-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">{ex.heading}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {seasonName(season)} · {eventName || code} · {ex.timestamp.replace("{date}", timestamp)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold print:hidden"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                <Printer className="w-4 h-4" /> {ex.print}
              </button>
              <button
                onClick={handleDownloadJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold print:hidden"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <Download className="w-4 h-4" /> {ex.downloadJson}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg print:hidden"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* My team */}
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {ex.captain} #{myMetrics.teamNumber}
                </span>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span>OPR <strong>{myMetrics.opr.toFixed(1)}</strong></span>
                  <span style={{ color: "var(--text-muted)" }}>·</span>
                  <span>Rely <strong>{myMetrics.reliability.toFixed(0)}</strong>/100</span>
                </div>
              </div>
              <TrustBadge metrics={myMetrics} />
            </div>
          </div>

          {/* Top picks */}
          {picks.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                {ex.topPicks}
              </h3>
              <div className="space-y-2">
                {picks.map((p, i) => (
                  <div
                    key={p.teamNumber}
                    className="rounded-xl px-4 py-3"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-mono w-5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base" style={{ color: "var(--accent)" }}>#{p.teamNumber}</span>
                          <span className="text-xs" style={{ color: p.availableForPick1 ? "var(--success)" : p.availableForPick2 ? "var(--warning)" : "var(--danger)" }}>
                            {p.availabilityTag}
                          </span>
                          {p.sensitivityTag !== "unknown" && (
                            <span className="text-[10px]" style={{ color: p.sensitivityTag === "robust" ? "var(--success)" : "var(--warning)" }}>
                              {p.sensitivityTag === "robust" ? t.analysis.sensitivityRobust : t.analysis.sensitivityFragile}
                            </span>
                          )}
                          <TrustBadge metrics={p.metrics} showStd={false} />
                        </div>
                        <div className="flex gap-3 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                          <span>OPR {p.metrics.opr.toFixed(1)}</span>
                          <span>·</span>
                          <span>Rely {p.metrics.reliability.toFixed(0)}/100</span>
                          {p.synergy.gapFilledAxis && (
                            <>
                              <span>·</span>
                              <span style={{ color: "var(--accent)" }}>
                                {t.analysis.fills.replace("{axis}", axisLabel(p.synergy.gapFilledAxis, t.analysis))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Pin + note buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 print:hidden">
                        <button
                          onClick={() => handleTogglePin(p.teamNumber)}
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors"
                          style={{
                            background: pinnedTeams.includes(p.teamNumber) ? "rgba(99,102,241,0.2)" : "var(--surface)",
                            color: pinnedTeams.includes(p.teamNumber) ? "var(--accent)" : "var(--text-muted)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <Pin className="w-2.5 h-2.5 inline mr-0.5" />
                          {pinnedTeams.includes(p.teamNumber) ? ex.unpinTeam : ex.pinTeam}
                        </button>
                        <button
                          onClick={() => { setEditingNote(p.teamNumber); setNoteInput(notes[p.teamNumber] ?? ""); }}
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                    {/* Note display */}
                    {editingNote === p.teamNumber ? (
                      <div className="mt-2 flex gap-2 print:hidden">
                        <input
                          autoFocus
                          className="flex-1 text-xs px-2 py-1 rounded"
                          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                          placeholder={ex.addNote}
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveNote(p.teamNumber); if (e.key === "Escape") setEditingNote(null); }}
                        />
                        <button onClick={() => handleSaveNote(p.teamNumber)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--accent)", color: "#fff" }}>
                          ✓
                        </button>
                      </div>
                    ) : notes[p.teamNumber] ? (
                      <p className="mt-1.5 text-xs italic" style={{ color: "var(--text-muted)" }}>
                        📝 {notes[p.teamNumber]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pinned teams */}
          {pinnedMetrics.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                {ex.pinnedTitle}
              </h3>
              <div className="flex flex-wrap gap-2">
                {pinnedMetrics.map((m) => (
                  <div key={m.teamNumber}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: "var(--surface-2)", border: "1px solid rgba(99,102,241,0.3)" }}>
                    <span className="font-bold" style={{ color: "var(--accent)" }}>#{m.teamNumber}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>OPR {m.opr.toFixed(1)}</span>
                    {notes[m.teamNumber] && <span className="ml-2 text-xs italic" style={{ color: "var(--text-muted)" }}>— {notes[m.teamNumber]}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Win probability */}
          {matchups.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                {t.analysis.winProbTitle}
              </h3>
              <div className="space-y-1.5">
                {matchups.map((m) => {
                  const pct = (m.winProbability * 100).toFixed(0);
                  const ci = (m.winProbabilityCI * 100).toFixed(0);
                  const col = m.winProbability >= 0.55 ? "var(--success)" : m.winProbability >= 0.45 ? "var(--warning)" : "var(--danger)";
                  return (
                    <div key={m.opponentCaptain} className="flex justify-between text-xs">
                      <span style={{ color: "var(--text-muted)" }}>
                        {t.analysis.vsAlliance.replace("{captain}", String(m.opponentCaptain))}
                      </span>
                      <span className="font-bold font-mono" style={{ color: col }}>
                        {t.analysis.winProbCI.replace("{win}", pct).replace("{ci}", ci)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function axisLabel(
  axis: "auto" | "dc" | "endgame",
  a: { axisAuto: string; axisDc: string; axisEndgame: string }
): string {
  if (axis === "auto") return a.axisAuto;
  if (axis === "dc") return a.axisDc;
  return a.axisEndgame;
}
