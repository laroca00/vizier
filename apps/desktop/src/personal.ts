import { useSyncExternalStore } from "react";

// What the player keeps for themselves: their champion pool, favourite
// champions, notes and the champions they looked at last.
// It stays on this computer, like the settings.

export type PoolRank = "main" | "secondary";

export type PoolPick = {
  championId: number;
  /** Uppercase role, null for any. */
  position: string | null;
  rank: PoolRank;
  note: string;
  /** A saved build from the library to use with this pick. */
  buildId: string | null;
};

export type Personal = {
  pool: PoolPick[];
  /** Champion ids marked with a star, separate from the pool. */
  favourites: number[];
  /** "c:103" for a champion, "m:103:238" for Ahri against Zed. */
  notes: Record<string, string>;
  /** Champion ids, most recently opened first. */
  recent: number[];
};

const DEFAULTS: Personal = { pool: [], favourites: [], notes: {}, recent: [] };
const MAX_RECENT = 8;
const KEY = "vizier.personal";
const listeners = new Set<() => void>();

const ids = (value: unknown) => (Array.isArray(value) ? value.filter((n): n is number => typeof n === "number") : []);

/**
 * Reads what any version stored. Pools from before 0.8 held only champion
 * and role; those entries become main picks with no note or build.
 */
export function parsePersonal(raw: string | null): Personal {
  try {
    const data = { ...DEFAULTS, ...JSON.parse(raw ?? "{}") } as Partial<Personal> & { pool?: Partial<PoolPick>[] };
    const pool = (Array.isArray(data.pool) ? data.pool : [])
      .filter((p) => typeof p?.championId === "number")
      .map((p) => ({
        championId: p.championId!,
        position: typeof p.position === "string" ? p.position : null,
        rank: p.rank === "secondary" ? ("secondary" as const) : ("main" as const),
        note: typeof p.note === "string" ? p.note : "",
        buildId: typeof p.buildId === "string" ? p.buildId : null,
      }));
    const notes = data.notes && typeof data.notes === "object" ? data.notes : {};
    // Older versions also kept goals here; they are dropped on the next write.
    return { pool, favourites: ids(data.favourites), notes, recent: ids(data.recent) };
  } catch {
    return DEFAULTS;
  }
}

function read(): Personal {
  try {
    return parsePersonal(localStorage.getItem(KEY));
  } catch {
    return DEFAULTS;
  }
}

let current = read();

// The overlay window reads the same notes.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    current = read();
    for (const listener of listeners) listener();
  });
}

function update(patch: (p: Personal) => Partial<Personal>) {
  current = { ...current, ...patch(current) };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Kept for this session.
  }
  for (const listener of listeners) listener();
}

export function usePersonal(): Personal {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export const inPool = (p: Personal, championId: number) => p.pool.some((x) => x.championId === championId);

const samePick = (a: { championId: number; position: string | null }, b: { championId: number; position: string | null }) =>
  a.championId === b.championId && a.position === b.position;

/** Adds the champion as a main pick, or takes every entry for it out of the pool. */
export function togglePool(championId: number, position: string | null) {
  update((p) => ({
    pool: inPool(p, championId) ? p.pool.filter((x) => x.championId !== championId) : [...p.pool, { championId, position, rank: "main", note: "", buildId: null }],
  }));
}

export function addToPool(championId: number, position: string | null, rank: PoolRank) {
  update((p) => (p.pool.some((x) => samePick(x, { championId, position })) ? {} : { pool: [...p.pool, { championId, position, rank, note: "", buildId: null }] }));
}

export function updatePoolPick(pick: Pick<PoolPick, "championId" | "position">, patch: Partial<Pick<PoolPick, "rank" | "note" | "buildId">>) {
  update((p) => ({ pool: p.pool.map((x) => (samePick(x, pick) ? { ...x, ...patch } : x)) }));
}

export function removeFromPool(pick: Pick<PoolPick, "championId" | "position">) {
  update((p) => ({ pool: p.pool.filter((x) => !samePick(x, pick)) }));
}

export function toggleFavouriteChampion(championId: number) {
  update((p) => ({ favourites: p.favourites.includes(championId) ? p.favourites.filter((id) => id !== championId) : [...p.favourites, championId] }));
}

export const championNoteKey = (championId: number) => `c:${championId}`;
export const matchupNoteKey = (championId: number, opponentId: number) => `m:${championId}:${opponentId}`;

export function setNote(key: string, text: string) {
  update((p) => {
    const notes = { ...p.notes };
    if (text.trim()) notes[key] = text;
    else delete notes[key];
    return { notes };
  });
}

/** The matchups the player wrote notes for, as opponent ids. */
export function notedMatchups(p: Personal, championId: number): number[] {
  const prefix = `m:${championId}:`;
  return Object.keys(p.notes)
    .filter((k) => k.startsWith(prefix))
    .map((k) => Number(k.slice(prefix.length)));
}

export function noteRecent(championId: number) {
  update((p) => ({ recent: [championId, ...p.recent.filter((id) => id !== championId)].slice(0, MAX_RECENT) }));
}
