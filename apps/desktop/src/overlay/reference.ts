import type { Combo } from "../data/comboTypes";
import { matchupNoteKey } from "../personal";
import type { LiveGame, LivePlayer } from "./live";

// The quick reference panel: the player picks which of these blocks it holds.

export const REF_SECTIONS = ["build", "runes", "skills", "combo", "note", "item"] as const;
export type RefSection = (typeof REF_SECTIONS)[number];

export const REF_NAMES: Record<RefSection, string> = {
  build: "Build",
  runes: "Rünler",
  skills: "Yetenek sırası",
  combo: "Kombo",
  note: "Eşleşme notu",
  item: "Eşya bilgisi",
};

export const DEFAULT_REF: RefSection[] = ["build", "skills", "note"];

/** Known sections only, each once, in the player's order. */
export function normalizeRef(raw: unknown): RefSection[] {
  if (!Array.isArray(raw)) return [...DEFAULT_REF];
  return [...new Set(raw.filter((x): x is RefSection => (REF_SECTIONS as readonly unknown[]).includes(x)))];
}

export function toggleRef(sections: RefSection[], section: RefSection): RefSection[] {
  return sections.includes(section) ? sections.filter((s) => s !== section) : [...sections, section];
}

/** Moves a section one place up or down; the edges stay put. */
export function moveRef(sections: RefSection[], section: RefSection, by: -1 | 1): RefSection[] {
  const from = sections.indexOf(section);
  const to = from + by;
  if (from < 0 || to < 0 || to >= sections.length) return sections;
  const next = [...sections];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The enemy in the player's role; without roles (ARAM, Arena) there is no lane opponent. */
export function laneOpponent(game: LiveGame, me: LivePlayer): LivePlayer | null {
  if (!me.position) return null;
  return game.players.find((p) => p.team !== me.team && p.position === me.position) ?? null;
}

/** Notes to show: the matchup note when there is one, else the champion's own. Empty text is no note. */
export function referenceNote(notes: Record<string, string>, championId: number, opponentId: number | null): { text: string; matchup: boolean } | null {
  const matchup = opponentId ? notes[matchupNoteKey(championId, opponentId)]?.trim() : "";
  if (matchup) return { text: matchup, matchup: true };
  const own = notes[`c:${championId}`]?.trim();
  return own ? { text: own, matchup: false } : null;
}

/** The easiest combos first, so the panel holds what can be done in a fight. */
export function panelCombos(combos: Combo[], limit = 2): Combo[] {
  return [...combos].sort((a, b) => a.difficulty - b.difficulty).slice(0, limit);
}
