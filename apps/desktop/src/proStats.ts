import type { ProBuild } from "./api";

export type Counted = { id: number; games: number };

export type ProSummary = {
  games: number;
  wins: number;
  team: string;
  platforms: string[];
  /** Most played first. */
  champions: { championId: number; games: number; wins: number }[];
  keystones: Counted[];
  items: Counted[];
  spells: Counted[];
};

function tally<T>(values: T[], key: (v: T) => number): Counted[] {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(key(v), (counts.get(key(v)) ?? 0) + 1);
  return [...counts].map(([id, games]) => ({ id, games })).sort((a, b) => b.games - a.games || a.id - b.id);
}

/** The same game can arrive once per tracked account; count it once. */
export function uniqueGames(builds: ProBuild[]): ProBuild[] {
  const seen = new Set<string>();
  return builds.filter((b) => {
    const key = `${b.player}:${b.matchId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * What a pro plays and builds, from their stored games. `finished` tells
 * complete items from components so the item list holds only what they ended with.
 */
export function summarizePlayer(builds: ProBuild[], keystoneOf: (b: ProBuild) => number, finished: (id: number) => boolean = () => true): ProSummary {
  const games = uniqueGames(builds);
  const byChampion = new Map<number, { games: number; wins: number }>();
  for (const b of games) {
    const entry = byChampion.get(b.championId) ?? { games: 0, wins: 0 };
    entry.games++;
    if (b.win) entry.wins++;
    byChampion.set(b.championId, entry);
  }
  const newest = [...games].sort((a, b) => b.gameStart - a.gameStart)[0];
  return {
    games: games.length,
    wins: games.filter((b) => b.win).length,
    team: newest?.team ?? "",
    platforms: [...new Set(games.map((b) => b.platform))],
    champions: [...byChampion]
      .map(([championId, v]) => ({ championId, ...v }))
      .sort((a, b) => b.games - a.games || b.wins - a.wins || a.championId - b.championId),
    keystones: tally(games, keystoneOf),
    items: tally(games.flatMap((b) => b.items.filter(finished)), (id) => id),
    spells: tally(games.flatMap((b) => b.spells.filter(Boolean)), (id) => id),
  };
}
