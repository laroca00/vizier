import type { Build, BuildStyle, Foe } from "./api";

// Fewer games than this and a win rate is mostly noise.
// Not statistical: the narrowest a bar is drawn, in games' worth of width, so a rare option stays visible.
export const BAR_MIN_GAMES = 20;
const SHOWN_ITEMS = 5;

export type SideColumn = {
  id: "popular" | "winrate" | Foe;
  style: BuildStyle | null;
  items: number[];
  games: number;
  /** Null when the data has no win rate for the whole group, as with the foe columns. */
  winRate: number | null;
};

/** The win-rate bar grows with the sample: 3% of the build's games, never under 20. */
export const winRateBar = (games: number) => Math.max(BAR_MIN_GAMES, Math.round(games * 0.03));

/**
 * The most played build, the best win rate among builds with enough games, and
 * the items bought against AP, AD and tank teams, so they can be read side by side.
 */
export function sideBySide(build: Build): { columns: SideColumn[]; bar: number; sameAsPopular: boolean } {
  const bar = winRateBar(build.games);
  const variants = build.variants ?? [];
  const coreOf = (picks: { coreItems: { ids: number[] } | null; items: { id: number }[] }) => (picks.coreItems?.ids.length ? picks.coreItems.ids : picks.items.map((i) => i.id)).slice(0, SHOWN_ITEMS);

  const popular = [...variants].sort((a, b) => b.games - a.games)[0];
  const best = variants.filter((v) => v.games >= bar).sort((a, b) => b.winRate - a.winRate)[0];
  const columns: SideColumn[] = [
    popular
      ? { id: "popular", style: popular.style, items: coreOf(popular), games: popular.games, winRate: popular.winRate }
      : { id: "popular", style: null, items: coreOf(build), games: build.games, winRate: build.winRate },
  ];
  if (best && best !== popular) columns.push({ id: "winrate", style: best.style, items: coreOf(best), games: best.games, winRate: best.winRate });
  for (const foe of (["ap", "ad", "tank"] as const)) {
    const group = build.situational?.find((s) => s.vs === foe);
    if (group && group.items.length) columns.push({ id: foe, style: null, items: group.items.slice(0, SHOWN_ITEMS).map((i) => i.id), games: group.games, winRate: null });
  }
  return { columns, bar, sameAsPopular: !!best && best === popular };
}
