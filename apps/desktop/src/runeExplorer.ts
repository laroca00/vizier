import type { BuildIndexEntry } from "./api";

export type KeystoneSummary = {
  keystone: number;
  /** Games of the champion builds that take it, so a count of builds, not of keystone picks. */
  games: number;
  /** Win rate of those games, weighted by games. */
  winRate: number;
  builds: BuildIndexEntry[];
};

/** Champion builds grouped by the keystone they take, with the weighted win rate; most played first. */
export function summarizeKeystones(index: BuildIndexEntry[]): Map<number, KeystoneSummary> {
  const found = new Map<number, KeystoneSummary>();
  for (const build of index) {
    if (!build.keystone || build.games <= 0) continue;
    const entry = found.get(build.keystone) ?? { keystone: build.keystone, games: 0, winRate: 0, builds: [] };
    entry.winRate = (entry.winRate * entry.games + build.winRate * build.games) / (entry.games + build.games);
    entry.games += build.games;
    entry.builds.push(build);
    found.set(build.keystone, entry);
  }
  for (const entry of found.values()) entry.builds.sort((a, b) => b.games - a.games);
  return found;
}
