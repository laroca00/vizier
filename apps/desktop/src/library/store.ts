import { useSyncExternalStore } from "react";

// The player's own builds and the collections they file them under. Only ids
// are stored; names and icons come from Data Dragon when shown, which keeps
// the entry small and right after a patch renames something.

export type RuneSelection = { primaryStyle: number; subStyle: number; perks: number[] };

export type SavedBuild = {
  id: string;
  name: string;
  championId: number;
  /** Uppercase match-v5 role, null for any. */
  position: string | null;
  runes: RuneSelection;
  spells: [number, number];
  startItems: number[];
  coreItems: number[];
  /** Situational and late items, after the core. */
  items: number[];
  /** Q, W and E as 1, 2 and 3, in the order they are maxed. */
  skillOrder: number[];
  notes: string;
  collections: string[];
  /** Free-form labels the player types; absent on builds saved before tags existed. */
  tags?: string[];
  favourite: boolean;
  /** Where it started: Vizier's stats, a pro game, or from scratch. */
  source: "stats" | "pro" | "custom";
  createdAt: number;
  updatedAt: number;
};

export type Library = { builds: SavedBuild[]; collections: string[] };

export const DEFAULT_COLLECTIONS = ["Ana", "Dereceli", "Deneysel", "ARAM"];

const KEY = "vizier.library";
const EMPTY: Library = { builds: [], collections: DEFAULT_COLLECTIONS };
const listeners = new Set<() => void>();

const numbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter((n): n is number => typeof n === "number") : []);

/** Drops anything malformed so one bad entry can't break the page. */
export function parseLibrary(raw: string | null): Library {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as Partial<Library>;
    const builds = (Array.isArray(data.builds) ? data.builds : []).filter(
      (b): b is SavedBuild => !!b && typeof b.id === "string" && typeof b.championId === "number" && !!b.runes && Array.isArray(b.runes.perks),
    );
    return {
      builds: builds.map((b) => ({
        ...b,
        name: String(b.name ?? ""),
        startItems: numbers(b.startItems),
        coreItems: numbers(b.coreItems),
        items: numbers(b.items),
        skillOrder: numbers(b.skillOrder),
        notes: String(b.notes ?? ""),
        collections: Array.isArray(b.collections) ? b.collections.filter((c) => typeof c === "string") : [],
        tags: Array.isArray(b.tags) ? b.tags.filter((t) => typeof t === "string") : [],
        favourite: b.favourite === true,
      })),
      collections: Array.isArray(data.collections) ? data.collections.filter((c): c is string => typeof c === "string") : DEFAULT_COLLECTIONS,
    };
  } catch {
    return EMPTY;
  }
}

function read(): Library {
  try {
    return parseLibrary(localStorage.getItem(KEY));
  } catch {
    return EMPTY;
  }
}

let current = read();

// Another window (the overlay) may change the library.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    current = read();
    for (const listener of listeners) listener();
  });
}

function update(change: (library: Library) => Library) {
  current = change(current);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Kept for this session; the page says nothing was lost until the app closes.
  }
  for (const listener of listeners) listener();
}

export function useLibrary(): Library {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export function getLibrary(): Library {
  return current;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type BuildDraft = Omit<SavedBuild, "id" | "createdAt" | "updatedAt">;

export function createBuild(draft: BuildDraft, now = Date.now()): SavedBuild {
  const build: SavedBuild = { ...draft, id: newId(), createdAt: now, updatedAt: now };
  update((library) => ({ ...library, builds: [build, ...library.builds] }));
  return build;
}

export function saveBuild(build: SavedBuild, now = Date.now()) {
  update((library) => ({ ...library, builds: library.builds.map((b) => (b.id === build.id ? { ...build, updatedAt: now } : b)) }));
}

export function duplicateBuild(id: string, copyName: (name: string) => string): SavedBuild | null {
  const source = current.builds.find((b) => b.id === id);
  if (!source) return null;
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
  return createBuild({ ...rest, name: copyName(source.name), favourite: false });
}

export function deleteBuild(id: string) {
  update((library) => ({ ...library, builds: library.builds.filter((b) => b.id !== id) }));
}

export function toggleFavourite(id: string) {
  update((library) => ({ ...library, builds: library.builds.map((b) => (b.id === id ? { ...b, favourite: !b.favourite } : b)) }));
}

export function addCollection(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  update((library) => (library.collections.includes(trimmed) ? library : { ...library, collections: [...library.collections, trimmed] }));
}

export function removeCollection(name: string) {
  update((library) => ({
    collections: library.collections.filter((c) => c !== name),
    builds: library.builds.map((b) => ({ ...b, collections: b.collections.filter((c) => c !== name) })),
  }));
}
