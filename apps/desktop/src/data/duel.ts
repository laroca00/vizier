// Base stats at a level, from Data Dragon's base value and per-level growth.

export const DUEL_LEVELS = [1, 3, 6, 11, 18] as const;

/** Riot's growth curve: a champion gets the per-level amount scaled by this, not n-1 flat. */
export const growthFactor = (level: number) => (level - 1) * (0.7025 + 0.0175 * (level - 1));

export type DuelStat = "hp" | "attackdamage" | "armor" | "spellblock" | "attackspeed" | "attackrange";

export const DUEL_STATS: DuelStat[] = ["hp", "attackdamage", "armor", "spellblock", "attackspeed", "attackrange"];

type Stats = Record<string, number>;

/** One stat at a level; attack speed grows as a percentage of the base, range does not grow. */
export function statAt(stats: Stats, stat: DuelStat, level: number): number {
  const base = stats[stat] ?? 0;
  if (stat === "attackrange") return base;
  const growth = stats[`${stat}perlevel`] ?? 0;
  if (stat === "attackspeed") return base * (1 + (growth / 100) * growthFactor(level));
  return base + growth * growthFactor(level);
}

export type DuelCell = { a: number; b: number; ahead: "a" | "b" | "even" };

// Under this difference the two are level for practical purposes.
const EVEN_WITHIN = 0.01;

export function duel(a: Stats, b: Stats): Record<DuelStat, Record<number, DuelCell>> {
  const rows = {} as Record<DuelStat, Record<number, DuelCell>>;
  for (const stat of DUEL_STATS) {
    rows[stat] = {};
    for (const level of DUEL_LEVELS) {
      const x = statAt(a, stat, level);
      const y = statAt(b, stat, level);
      const gap = Math.abs(x - y) / Math.max(x, y, 1e-9);
      rows[stat][level] = { a: x, b: y, ahead: gap < EVEN_WITHIN ? "even" : x > y ? "a" : "b" };
    }
  }
  return rows;
}
