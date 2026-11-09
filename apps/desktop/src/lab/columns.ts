import type { Build } from "../api";
import { winRateBar } from "../buildSideBySide";
import { fromPicks } from "../library/convert";
import type { BuildDraft, SavedBuild } from "../library/store";

// The columns of the Itemization Lab: the build most players use, the one that
// wins most among those with enough games, and one of the player's own.

export type LabColumn = {
  id: "popular" | "winrate" | "saved";
  /** What the column is, in Turkish for t(). */
  label: string;
  build: BuildDraft;
  /** Null for the player's own build, which has no sample. */
  sample: { games: number; winRate: number } | null;
  /** Variant style when the numbers are for one way of building the champion. */
  style: string | null;
};

export const MAX_COLUMNS = 3;

type Context = { position: string | null; finished: (id: number) => boolean };

/** The saved build to start the third column with: favourites first, then the one touched last. */
export function savedFor(builds: SavedBuild[], championId: number, position: string | null): SavedBuild[] {
  return builds
    .filter((b) => b.championId === championId && (b.position === null || position === null || b.position === position))
    .sort((a, b) => Number(b.favourite) - Number(a.favourite) || b.updatedAt - a.updatedAt);
}

export function labColumns(build: Build | null, saved: SavedBuild | null, championId: number, ctx: Context): LabColumn[] {
  const base = { name: "", championId, position: ctx.position };
  const columns: LabColumn[] = [];
  if (build) {
    const variants = build.variants ?? [];
    const popular = [...variants].sort((a, b) => b.games - a.games)[0];
    const bar = winRateBar(build.games);
    const best = variants.filter((v) => v.games >= bar).sort((a, b) => b.winRate - a.winRate)[0];
    const from = (id: LabColumn["id"], label: string, v: Pick<Build, "games" | "winRate"> & Parameters<typeof fromPicks>[1], style: string | null): LabColumn => ({
      id,
      label,
      build: fromPicks(base, v, ctx.finished),
      sample: { games: v.games, winRate: v.winRate },
      style,
    });
    columns.push(popular ? from("popular", "En çok oynanan", popular, popular.style) : from("popular", "En çok oynanan", build, null));
    if (best && best !== popular) columns.push(from("winrate", "En yüksek kazanma", best, best.style));
  }
  if (saved && columns.length < MAX_COLUMNS) {
    columns.push({ id: "saved", label: "Kayıtlı build'in", build: saved, sample: null, style: null });
  }
  return columns;
}
