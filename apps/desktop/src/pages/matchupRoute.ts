import { fold } from "../fold";
import type { Champion } from "../data/ddragon";
import type { Route } from "../router";

export type MatchupRoute = Extract<Route, { page: "matchup" }>;

/** A champion typed by name; the match ignores case, accents and punctuation ("kaisa" finds Kai'Sa). */
export function findChampion(list: Iterable<Champion>, text: string): Champion | null {
  const needle = fold(text);
  if (!needle) return null;
  for (const champion of list) if (fold(champion.name) === needle) return champion;
  return null;
}

export function swapSides(route: MatchupRoute): MatchupRoute {
  return { ...route, championId: route.opponentId, opponentId: route.championId };
}

/** Both sides chosen and different. */
export function isComplete(route: MatchupRoute): route is MatchupRoute & { championId: number; opponentId: number } {
  return route.championId !== null && route.opponentId !== null && route.championId !== route.opponentId;
}

/** The role a champion is usually played in, from its class; a starting point the player can change. */
export function guessPosition(champion: Champion): string {
  switch (champion.tags[0]) {
    case "Support":
      return "UTILITY";
    case "Marksman":
      return "BOTTOM";
    case "Fighter":
    case "Tank":
      return "TOP";
    default:
      return "MIDDLE";
  }
}

const VERSUS = /\s+(?:vs\.?|x|-)\s+/i;

/** "Ahri vs Zed" as two champions; names may be partial on the second side while typing, but must match exactly on the first. */
export function parseMatchupQuery(query: string, list: Champion[]): { a: Champion; b: Champion } | null {
  const parts = query.trim().split(VERSUS);
  if (parts.length !== 2) return null;
  const a = findChampion(list, parts[0]);
  if (!a) return null;
  const needle = fold(parts[1]);
  if (!needle) return null;
  const b = findChampion(list, parts[1]) ?? list.find((c) => c.key !== a.key && fold(c.name).startsWith(needle)) ?? null;
  return b && b.key !== a.key ? { a, b } : null;
}
