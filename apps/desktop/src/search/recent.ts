import { fold } from "../fold";
// The last things the player searched for, newest first. Kept on this
// computer with the other local data.

export const MAX_RECENT_SEARCHES = 6;
export const RECENT_KEY = "vizier.recentSearches";

export function parseRecent(raw: string | null): string[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return Array.isArray(list) ? list.filter((q): q is string => typeof q === "string" && q.trim().length >= 2).slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

/** Puts the query first and drops an earlier copy of it; one-letter queries are not worth keeping. */
export function addRecent(list: string[], query: string): string[] {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return list;
  return [q, ...list.filter((x) => fold(x) !== fold(q))].slice(0, MAX_RECENT_SEARCHES);
}

export function readRecent(): string[] {
  try {
    return parseRecent(localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

export function writeRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Kept for this session only.
  }
}
