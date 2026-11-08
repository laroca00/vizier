import type { Ability } from "./ddragon";

export type RankRow = { rank: number; cooldown: number | null; cost: number | null; range: number | null };

// Data Dragon marks abilities without a targeting range with this value.
const NO_RANGE = 25000;

const known = (value: number | undefined, unknownAt: (n: number) => boolean = () => false) =>
  value === undefined || Number.isNaN(value) || unknownAt(value) ? null : value;

/** Cooldown, cost and range for each rank; null where Data Dragon publishes nothing useful. */
export function rankRows(ability: Ability): RankRow[] {
  const ranks = Math.max(ability.cooldowns.length, ability.costs?.length ?? 0, ability.ranges?.length ?? 0);
  return Array.from({ length: ranks }, (_, i) => ({
    rank: i + 1,
    cooldown: known(ability.cooldowns[i], (n) => n <= 0),
    cost: known(ability.costs?.[i], (n) => n <= 0),
    range: known(ability.ranges?.[i], (n) => n <= 0 || n >= NO_RANGE),
  }));
}

/** False when nothing but empty cells would be shown. */
export const hasRankData = (rows: RankRow[]) => rows.some((r) => r.cooldown !== null || r.cost !== null || r.range !== null);
