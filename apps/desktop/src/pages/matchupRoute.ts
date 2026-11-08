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
