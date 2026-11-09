import { STAT_PRICES } from "../data/itemGold";

// Stats of a build added up from Data Dragon's item stats. Penetration, haste and
// omnivamp are not in those stats, so they cannot be summed here and are not shown.

export const TOTAL_STATS = [
  "FlatPhysicalDamageMod",
  "FlatMagicDamageMod",
  "FlatHPPoolMod",
  "FlatArmorMod",
  "FlatSpellBlockMod",
  "PercentAttackSpeedMod",
  "FlatCritChanceMod",
  "PercentLifeStealMod",
  "FlatMPPoolMod",
  "FlatMovementSpeedMod",
] as const;

export type StatTotals = Partial<Record<(typeof TOTAL_STATS)[number], number>>;

type Stated = { stats: Record<string, number> };

export function sumStats(ids: number[], details: Map<number, Stated>): StatTotals {
  const total: StatTotals = {};
  for (const id of ids) {
    const stats = details.get(id)?.stats ?? {};
    for (const key of TOTAL_STATS) {
      const value = stats[key];
      if (Number.isFinite(value) && value) total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

/** Totals after the first item, the first two, and so on. */
export function runningTotals(ids: number[], details: Map<number, Stated>): StatTotals[] {
  return ids.map((_, i) => sumStats(ids.slice(0, i + 1), details));
}

/** The stats any of the columns has something in, in a fixed order. */
export function shownStats(columns: StatTotals[]): (typeof TOTAL_STATS)[number][] {
  return TOTAL_STATS.filter((key) => columns.some((c) => (c[key] ?? 0) > 0));
}

/** Display value: percent stats are shown as points. */
export function statValue(key: (typeof TOTAL_STATS)[number], value: number): number {
  return STAT_PRICES[key]?.percent ? Math.round(value * 100) : Math.round(value);
}

/** Bar width in percent of the largest column for that stat. */
export function barShare(columns: StatTotals[], key: (typeof TOTAL_STATS)[number], index: number): number {
  const max = Math.max(...columns.map((c) => c[key] ?? 0));
  return max > 0 ? Math.round(((columns[index][key] ?? 0) / max) * 100) : 0;
}
