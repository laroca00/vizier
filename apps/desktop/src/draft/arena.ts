import type { ChampSelect } from "../lcu";
import type { ArenaDuos, ArenaItems } from "../api";
import type { Item } from "../data/ddragon";

/** Arena teams are duos; no other mode seats two players on a team. */
export function isArena(draft: ChampSelect): boolean {
  return draft.myTeam.length === 2 && !draft.myTeam.some((m) => m.position !== "");
}

export type DuoPick = { championId: number; games: number; winRate: number; inPool: boolean };

/**
 * Partners to pair with a champion, in the server's order. Taken champions
 * are dropped; the player's own pool is only flagged, not moved up, since the
 * order already reflects how the pairing does.
 */
export function duoPicks(duos: ArenaDuos, taken: Set<number>, pool: Set<number>, limit = 5): DuoPick[] {
  return duos.partners
    .filter((p) => !taken.has(p.championId))
    .slice(0, limit)
    .map((p) => ({ ...p, inPool: pool.has(p.championId) }));
}

/** Finished items only: Arena lists carry components, boots and consumables too. */
export function finishedArenaItems(stats: ArenaItems, items: Map<number, Item>, limit = 8): ArenaItems["items"] {
  return stats.items.filter((i) => items.get(i.id)?.complete).slice(0, limit);
}
