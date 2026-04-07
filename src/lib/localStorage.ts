import type { CaptainArchetype, MonteCarloScenario } from "./analytics";

// ─── Typed localStorage helpers ───────────────────────────────────────────────
// All keys are namespaced per-event so multiple events don't collide.

function eventKey(season: number, code: string, suffix: string): string {
  return `scoutselect_event_${season}_${code}_${suffix}`;
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or SSR — silently ignore
  }
}

// ─── Pinned teams ──────────────────────────────────────────────────────────────

export function getPinnedTeams(season: number, code: string): number[] {
  return safeGet<number[]>(eventKey(season, code, "pins"), []);
}

export function setPinnedTeams(season: number, code: string, pins: number[]): void {
  safeSet(eventKey(season, code, "pins"), pins);
}

export function togglePinnedTeam(season: number, code: string, teamNumber: number): number[] {
  const current = getPinnedTeams(season, code);
  const next = current.includes(teamNumber)
    ? current.filter((t) => t !== teamNumber)
    : [...current, teamNumber];
  setPinnedTeams(season, code, next);
  return next;
}

// ─── Event settings (scenario + archetype) ────────────────────────────────────

export interface EventSettings {
  scenario: MonteCarloScenario;
  archetype: CaptainArchetype;
}

const DEFAULT_SETTINGS: EventSettings = { scenario: "nominal", archetype: "balanced" };

export function getEventSettings(season: number, code: string): EventSettings {
  return safeGet<EventSettings>(eventKey(season, code, "settings"), DEFAULT_SETTINGS);
}

export function setEventSettings(season: number, code: string, settings: EventSettings): void {
  safeSet(eventKey(season, code, "settings"), settings);
}

// ─── Scouting notes (short text per team) ─────────────────────────────────────

export type ScoutingNotes = Record<number, string>;

export function getScoutingNotes(season: number, code: string): ScoutingNotes {
  return safeGet<ScoutingNotes>(eventKey(season, code, "notes"), {});
}

export function setScoutingNote(season: number, code: string, teamNumber: number, note: string): ScoutingNotes {
  const notes = getScoutingNotes(season, code);
  if (note.trim()) {
    notes[teamNumber] = note.trim();
  } else {
    delete notes[teamNumber];
  }
  safeSet(eventKey(season, code, "notes"), notes);
  return notes;
}
