import type { Combo } from "../data/combos";

const DAY = 86_400_000;

/** Days since 1970 in local time, so the pick changes at the player's midnight. */
export function localDay(now: Date): number {
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / DAY);
}

/**
 * One combo for the day, the same all day long. Champions from the player's
 * pool come first; with none of them written up, any champion with combos.
 */
export function dailyCombo(day: number, pool: string[], all: string[], combosOf: (championId: string) => Combo[]): { championId: string; combo: Combo } | null {
  const withCombos = (ids: string[]) => ids.filter((id) => combosOf(id).length > 0);
  const fromPool = withCombos(pool);
  const choices = fromPool.length > 0 ? fromPool : withCombos(all);
  if (choices.length === 0) return null;
  const championId = choices[day % choices.length];
  const combos = combosOf(championId);
  // A second step through the list so the same champion doesn't always show its first combo.
  return { championId, combo: combos[Math.floor(day / choices.length) % combos.length] };
}
