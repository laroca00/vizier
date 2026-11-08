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

export type TierColumn = "tier" | "name" | "winRate" | "change" | "pickRate" | "banRate" | "games";

/** Everything the tier list page remembers, kept in the route so Back returns to the same view. */
export type TierView = {
  queue: number;
  position: string;
  sort: TierColumn;
  /** Best or highest first. */
  desc: boolean;
  query: string;
  poolOnly: boolean;
  hideThin: boolean;
};

export const DEFAULT_TIER_VIEW: TierView = { queue: 420, position: "MIDDLE", sort: "tier", desc: true, query: "", poolOnly: false, hideThin: false };

const fold = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");

const VALUE: Record<Exclude<TierColumn, "tier" | "name">, (e: TierEntry) => number | null> = {
  winRate: (e) => e.winRate,
  change: (e) => e.winRateChange,
  pickRate: (e) => e.pickRate,
  banRate: (e) => e.banRate ?? null,
  games: (e) => e.games,
};

/** Filters by name, pool and sample size, then sorts. Rows without a value for the column always go last. */
export function viewTiers(list: TierEntry[], view: TierView, nameOf: (championId: number) => string, poolIds: Set<number>): TierEntry[] {
  const query = fold(view.query.trim());
  const rows = list.filter(
    (e) => (!query || fold(nameOf(e.championId)).includes(query)) && (!view.poolOnly || poolIds.has(e.championId)) && (!view.hideThin || !isThin(e)),
  );
  const direction = view.desc ? 1 : -1;
  if (view.sort === "tier") return direction === 1 ? rows : [...rows].reverse();
  if (view.sort === "name") return [...rows].sort((a, b) => -direction * nameOf(a.championId).localeCompare(nameOf(b.championId)));
  const value = VALUE[view.sort];
  const rate = view.sort === "winRate" || view.sort === "pickRate";
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return Number(va === null) - Number(vb === null);
    // A lucky small sample never tops a win rate list.
    const thin = rate ? Number(a.games < MIN_SORT_GAMES) - Number(b.games < MIN_SORT_GAMES) : 0;
    return thin || direction * (vb - va);
  });
}
