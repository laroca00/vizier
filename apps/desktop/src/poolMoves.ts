import type { TierEntry } from "./api";
import { roleOfPick } from "./poolCoverage";

export type PoolMove = { championId: number; position: string; winRate: number; winRateChange: number | null; games: number };

/**
 * Each pool pick's win rate and its change since the previous patch, from the
 * role tier lists. Picks without a role use the one the champion is picked in most.
 */
export function poolMoves(pool: { championId: number; position: string | null }[], lists: Record<string, TierEntry[]>): PoolMove[] {
  const roles = new Map<number, Map<string, { pickRate: number }>>();
  for (const [position, entries] of Object.entries(lists)) {
    for (const e of entries) roles.set(e.championId, (roles.get(e.championId) ?? new Map()).set(position, e));
  }
  const seen = new Set<string>();
  return pool
    .flatMap((pick) => {
      const position = roleOfPick(pick, roles);
      const entry = position ? lists[position]?.find((e) => e.championId === pick.championId) : undefined;
      const key = `${pick.championId}:${position}`;
      if (!position || !entry || seen.has(key)) return [];
      seen.add(key);
      return [{ championId: pick.championId, position, winRate: entry.winRate, winRateChange: entry.winRateChange, games: entry.games }];
    })
    .sort((a, b) => Math.abs(b.winRateChange ?? 0) - Math.abs(a.winRateChange ?? 0));
}
