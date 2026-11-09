import type { TierEntry } from "./api";
import { confidenceOf } from "./data/confidence";
import { roleOfPick } from "./poolCoverage";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const AUTOFILL_PER_ROLE = 3;
/** Data Dragon's difficulty is 0-10; autofill picks stay simple to play. */
const AUTOFILL_MAX_DIFFICULTY = 5;

export type QueuePick = { championId: number; position: string; rank: "main" | "secondary"; buildId: string | null; entry: TierEntry | null };

/**
 * The pool champions for the roles the player asked for, mains first. A pick
 * without a role is placed where the champion is played most. Without chosen
 * roles (fill, no lobby) the whole pool is listed under its own roles.
 */
export function queuePool(
  pool: { championId: number; position: string | null; rank: "main" | "secondary"; buildId: string | null }[],
  roles: string[],
  lists: Record<string, TierEntry[]>,
): QueuePick[] {
  const byChampion = new Map<number, Map<string, { pickRate: number }>>();
  for (const [position, entries] of Object.entries(lists)) {
    for (const e of entries) byChampion.set(e.championId, (byChampion.get(e.championId) ?? new Map()).set(position, e));
  }
  const seen = new Set<string>();
  return pool
    .flatMap((pick) => {
      const position = roleOfPick(pick, byChampion);
      if (!position || (roles.length > 0 && !roles.includes(position))) return [];
      const key = `${pick.championId}:${position}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ championId: pick.championId, position, rank: pick.rank, buildId: pick.buildId, entry: lists[position]?.find((e) => e.championId === pick.championId) ?? null }];
    })
    .sort((a, b) => ROLES.indexOf(a.position) - ROLES.indexOf(b.position) || Number(b.rank === "main") - Number(a.rank === "main"));
}

export type AutofillPick = { championId: number; position: string; entry: TierEntry };

/**
 * For roles the player did not pick: the champions that win most while being
 * simple to play, from reliable or limited samples only. Champions already in
 * the pool are left out, since the pool list shows them.
 */
export function autofillPicks(
  roles: string[],
  lists: Record<string, TierEntry[]>,
  difficultyOf: (championId: number) => number | null,
  exclude: ReadonlySet<number>,
  patches: Record<string, string[]> = {},
): AutofillPick[] {
  return ROLES.filter((role) => !roles.includes(role)).flatMap((role) =>
    (lists[role] ?? [])
      .filter((e) => !exclude.has(e.championId))
      .filter((e) => {
        const difficulty = difficultyOf(e.championId);
        return difficulty !== null && difficulty <= AUTOFILL_MAX_DIFFICULTY;
      })
      .filter((e) => confidenceOf({ games: e.games, winRate: e.winRate, patches: patches[role] }) !== "insufficient")
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, AUTOFILL_PER_ROLE)
      .map((entry) => ({ championId: entry.championId, position: role, entry })),
  );
}
