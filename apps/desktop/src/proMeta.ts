import type { ProMetaEntry } from "./api";

export type MetaRow = { championId: number; games: number; wins: number; /** Share of the scope's pro games, 0-1. */ share: number };

/** The page greys a pro win rate whose interval is too wide; see hasEnoughGames. */
export { hasEnoughGames as proRateIsSettled } from "./data/confidence";

/**
 * Champions of one role (or all roles merged) by pro games. Share is out of
 * every pro game in that scope, not of the champions listed.
 */
export function metaRows(entries: ProMetaEntry[], position: string | null): MetaRow[] {
  const scope = position ? entries.filter((e) => e.position === position) : entries;
  const total = scope.reduce((sum, e) => sum + e.games, 0);
  const merged = new Map<number, { games: number; wins: number }>();
  for (const e of scope) {
    const row = merged.get(e.championId) ?? { games: 0, wins: 0 };
    row.games += e.games;
    row.wins += e.wins;
    merged.set(e.championId, row);
  }
  return [...merged]
    .map(([championId, v]) => ({ championId, ...v, share: total ? v.games / total : 0 }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.championId - b.championId);
}
