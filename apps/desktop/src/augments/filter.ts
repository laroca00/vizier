import type { AugmentStat, AugmentStats } from "../api";

/** CommunityDragon's rarity numbers the tier list can filter by. */
export const RARITY_FILTERS = [
  { value: "ALL", rarity: null, label: "Tüm nadirlikler" },
  { value: "0", rarity: 0, label: "Gümüş" },
  { value: "1", rarity: 1, label: "Altın" },
  { value: "2", rarity: 2, label: "Prizmatik" },
] as const;

// The server tiers a win rate pulled towards 50% by 200 games at even odds;
// merged class lists have no server tier, so they are tiered the same way.
const PRIOR_GAMES = 200;
const CUTS: [number, string][] = [[0.5175, "S"], [0.5085, "A"], [0.4985, "B"], [0.489, "C"]];

export function tierOf(wins: number, games: number): string {
  const score = (wins + PRIOR_GAMES / 2) / (games + PRIOR_GAMES);
  return CUTS.find(([cut]) => score >= cut)?.[1] ?? "D";
}

/** Several champions' augment stats as one list, weighted by games. */
export function mergeAugmentStats(docs: AugmentStats[]): AugmentStats {
  const games = docs.reduce((sum, d) => sum + d.games, 0);
  const byId = new Map<number, { games: number; wins: number }>();
  for (const doc of docs) {
    for (const a of doc.augments) {
      const entry = byId.get(a.augmentId) ?? { games: 0, wins: 0 };
      entry.games += a.games;
      entry.wins += a.winRate * a.games;
      byId.set(a.augmentId, entry);
    }
  }
  const augments: AugmentStat[] = [...byId].map(([augmentId, e]) => ({
    augmentId,
    games: e.games,
    pickRate: Math.round((e.games / Math.max(games, 1)) * 1000) / 1000,
    winRate: Math.round((e.wins / e.games) * 1000) / 1000,
    tier: tierOf(e.wins, e.games),
  }));
  augments.sort((a, b) => a.tier === b.tier ? b.winRate - a.winRate : a.tier.localeCompare(b.tier));
  return { patches: docs[0]?.patches ?? [], games, augments };
}

/** The most played champions of a class, from the mode's tier list. */
export function classChampions(
  entries: { championId: number; games: number }[],
  tagsOf: (championId: number) => string[] | undefined,
  tag: string,
  limit: number,
): number[] {
  return entries
    .filter((e) => tagsOf(e.championId)?.[0] === tag)
    .sort((a, b) => b.games - a.games)
    .slice(0, limit)
    .map((e) => e.championId);
}
