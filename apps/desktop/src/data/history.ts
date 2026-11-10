import type { Bracket } from "@vizier/shared/brackets";

/** [day, games, winRate, pickRate, banRate]; the counts are the patch's total up to that day. */
export type HistoryPoint = [string, number, number, number, number];

export type ChampionHistoryDoc = {
  roles: Record<string, Partial<Record<Bracket, Record<string, HistoryPoint[]>>>>;
};

export type TierHistoryDoc = { patch: string | null; days: string[]; champions: Record<string, { games: number[]; winRate: number[] }> };

/** A trend needs several days and a sample that is not just a handful of games. */
export const MIN_TREND_POINTS = 3;
export const MIN_TREND_GAMES = 100;

export type Trend = { values: number[]; games: number; first: number; last: number };

/** Points of the newest patch for one role and bracket, or null when there is no trend worth drawing. */
export function trendOf(doc: ChampionHistoryDoc | null | undefined, position: string, bracket: Bracket, field: 2 | 3 | 4 = 2): Trend | null {
  const byPatch = doc?.roles?.[position]?.[bracket];
  if (!byPatch) return null;
  // Patch names sort as numbers: "16.10" comes after "16.9".
  const patch = Object.keys(byPatch).sort((a, b) => {
    const [aMajor, aMinor] = a.split(".").map(Number);
    const [bMajor, bMinor] = b.split(".").map(Number);
    return aMajor - bMajor || aMinor - bMinor;
  }).pop();
  const points = patch ? byPatch[patch] : undefined;
  return build(points?.map((p) => p[field] as number), points?.[points.length - 1]?.[1] ?? 0);
}

/** The same from the tier list's one-document-per-role history, skipping days the champion had no games. */
export function tierTrend(doc: TierHistoryDoc | null | undefined, championId: number): Trend | null {
  const row = doc?.champions?.[championId];
  if (!row) return null;
  const used = row.games.map((g, i) => (g > 0 ? i : -1)).filter((i) => i >= 0);
  return build(used.map((i) => row.winRate[i]), used.length ? row.games[used[used.length - 1]] : 0);
}

function build(values: number[] | undefined, games: number): Trend | null {
  if (!values || values.length < MIN_TREND_POINTS || games < MIN_TREND_GAMES) return null;
  return { values, games, first: values[0], last: values[values.length - 1] };
}
