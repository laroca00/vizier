export type Entry = { games: number; winRate: number };
export type ComparisonRow<T> = { entry: T; games: number; winRate: number; pickRate: number };

// Not a rate cut-off: rows this rare only clutter the pick-rate list, and each row shows its own game count.
const MIN_GAMES = 5;

/** Rows with their pick rate out of the build's games, most played first; rare ones are dropped. */
export function comparisonRows<T extends Entry>(entries: T[], total: number, limit: number): ComparisonRow<T>[] {
  if (total <= 0) return [];
  return entries
    .filter((e) => e.games >= MIN_GAMES)
    .sort((a, b) => b.games - a.games)
    .slice(0, limit)
    .map((entry) => ({ entry, games: entry.games, winRate: entry.winRate, pickRate: entry.games / total }));
}
