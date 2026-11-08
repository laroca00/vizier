import type { TierEntry } from "../api";

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
