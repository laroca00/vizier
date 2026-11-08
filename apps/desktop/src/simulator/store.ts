import { useSyncExternalStore } from "react";

// Drafts the player sets up by hand, kept on this computer.

export const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

export type Side = "blue" | "red";
/** One champion per role slot; 0 while empty. */
export type Team = number[];
export type Draft = { blue: Team; red: Team };
export type SavedDraft = Draft & { id: string; name: string; createdAt: number; updatedAt: number };

export const emptyTeam = (): Team => ROLES.map(() => 0);
export const emptyDraft = (): Draft => ({ blue: emptyTeam(), red: emptyTeam() });

/** Whose pick it is in ranked: B1, R1, R2, B2, B3, R3, R4, B4, B5, R5. */
export const PICK_ORDER: Side[] = ["blue", "red", "red", "blue", "blue", "red", "red", "blue", "blue", "red"];

/** Puts a champion in a slot; a champion is in a draft once, so it leaves any other slot. */
export function place(draft: Draft, side: Side, slot: number, championId: number): Draft {
  const clear = (team: Team) => team.map((id) => (id === championId ? 0 : id));
  const next = { blue: clear(draft.blue), red: clear(draft.red) };
  next[side] = next[side].map((id, i) => (i === slot ? championId : id));
  return next;
}

/** The side whose turn it is in ranked order, from how many champions are in. */
export function sideToPick(draft: Draft): Side | null {
  const picks = [...draft.blue, ...draft.red].filter((id) => id > 0).length;
  const side = PICK_ORDER[picks];
  if (!side) return null;
  // A side filled out of order hands its turns to the other.
  if (draft[side].every((id) => id > 0)) return side === "blue" ? "red" : "blue";
  return side;
}

/** The next empty slot: the side whose turn it is when following pick order, otherwise down the same side, then the other. */
export function nextSlot(draft: Draft, usePickOrder: boolean, from: { side: Side; slot: number }): { side: Side; slot: number } | null {
  if (usePickOrder) {
    const side = sideToPick(draft);
    if (!side) return null;
    return { side, slot: draft[side].findIndex((id) => id === 0) };
  }
  const other: Side = from.side === "blue" ? "red" : "blue";
  for (const side of [from.side, other]) {
    const slot = draft[side].findIndex((id) => id === 0);
    if (slot >= 0) return { side, slot };
  }
  return null;
}

/** Swaps the champions of two slots on one side, for fixing roles. */
export function swap(draft: Draft, side: Side, a: number, b: number): Draft {
  const team = [...draft[side]];
  [team[a], team[b]] = [team[b], team[a]];
  return { ...draft, [side]: team };
}

const KEY = "vizier.drafts";
const listeners = new Set<() => void>();

const team = (value: unknown): Team => {
  const ids = Array.isArray(value) ? value.map((n) => (typeof n === "number" ? n : 0)) : [];
  return ROLES.map((_, i) => ids[i] ?? 0);
};

export function parseDrafts(raw: string | null): SavedDraft[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return (Array.isArray(list) ? list : [])
      .filter((d) => d && typeof d.id === "string")
      .map((d) => ({ id: d.id, name: String(d.name ?? ""), blue: team(d.blue), red: team(d.red), createdAt: Number(d.createdAt) || 0, updatedAt: Number(d.updatedAt) || 0 }));
  } catch {
    return [];
  }
}

function read() {
  try {
    return parseDrafts(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

let current = read();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    current = read();
    for (const listener of listeners) listener();
  });
}

function write(next: SavedDraft[]) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept for this session.
  }
  for (const listener of listeners) listener();
}

export function useSavedDrafts(): SavedDraft[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function saveDraft(draft: Draft, name: string, id: string | null, now = Date.now()): string {
  if (id && current.some((d) => d.id === id)) {
    write(current.map((d) => (d.id === id ? { ...d, ...draft, name, updatedAt: now } : d)));
    return id;
  }
  const saved: SavedDraft = { ...draft, id: newId(), name, createdAt: now, updatedAt: now };
  write([saved, ...current]);
  return saved.id;
}

export function duplicateDraft(id: string, copyName: (name: string) => string): string | null {
  const source = current.find((d) => d.id === id);
  return source ? saveDraft({ blue: [...source.blue], red: [...source.red] }, copyName(source.name), null) : null;
}

export function deleteDraft(id: string) {
  write(current.filter((d) => d.id !== id));
}
