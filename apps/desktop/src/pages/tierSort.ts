import type { TierEntry } from "../api";

/** The server ranks a champion from 30 games; the tier only means something from this many. */
export const THIN_GAMES = 100;

export const isThin = (entry: Pick<TierEntry, "games">) => entry.games < THIN_GAMES;

export function withoutThin(list: TierEntry[], hide: boolean): TierEntry[] {
  return hide ? list.filter((c) => !isThin(c)) : list;
}

export type TierSort = "tier" | "winRate" | "pickRate";

/** Rows under this many games sort below the rest, so a lucky small sample never tops a win rate list. */
export const MIN_SORT_GAMES = 150;

/** "tier" keeps the server's order, which is already ranked by tier score. */
export function sortTiers(list: TierEntry[], by: TierSort): TierEntry[] {
  if (by === "tier") return list;
  return [...list].sort((a, b) => {
    const thin = Number(a.games < MIN_SORT_GAMES) - Number(b.games < MIN_SORT_GAMES);
    return thin || b[by] - a[by];
  });
}
