import type { Build } from "../api";
import { winRateBar } from "../buildSideBySide";
import { fromPicks } from "../library/convert";
import type { LabColumn } from "./columns";

export type ItemNode = { id: number; games: number; winRate: number; next: ItemNode[] };
export type PathKind = "winning" | "popular";
export type ChosenPath = { ids: number[]; games: number; winRate: number };

/** Every route from the first item down to a branch's end, with the games and win rate of its last item. */
function routes(nodes: ItemNode[], prefix: number[] = []): ChosenPath[] {
  return nodes.flatMap((n) => {
    const ids = [...prefix, n.id];
    return n.next.length === 0 ? [{ ids, games: n.games, winRate: n.winRate }] : routes(n.next, ids);
  });
}

/**
 * "popular" follows the most played branch at each step; "winning" is the route with the best win rate
 * among those with enough games to count (the same bar the lab uses for build styles).
 */
export function chosenPath(tree: ItemNode[] | undefined, kind: PathKind, totalGames: number): ChosenPath | null {
  if (!tree?.length) return null;
  if (kind === "popular") {
    const ids: number[] = [];
    let level = tree;
    let last = tree[0];
    while (level.length > 0) {
      last = level[0];
      ids.push(last.id);
      level = last.next;
    }
    return { ids, games: last.games, winRate: last.winRate };
  }
  const bar = winRateBar(totalGames);
  return routes(tree).filter((r) => r.games >= bar).sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0] ?? null;
}

type Context = { position: string | null; finished: (id: number) => boolean };

/** A lab column whose core items are one route of the item tree; everything else follows the popular build. */
export function pathColumn(build: Build, kind: PathKind, championId: number, ctx: Context): LabColumn | null {
  const path = chosenPath(build.itemTree, kind, build.games);
  if (!path) return null;
  const picks = { ...build, coreItems: { ids: path.ids, games: path.games, winRate: path.winRate } };
  return {
    id: "path",
    label: kind === "winning" ? "En çok kazanan yol" : "En popüler yol",
    build: fromPicks({ name: "", championId, position: ctx.position }, picks, ctx.finished),
    sample: { games: path.games, winRate: path.winRate },
    basis: "data",
    style: null,
  };
}
