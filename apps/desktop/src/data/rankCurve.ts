import type { Bracket } from "@vizier/shared/brackets";
import { hasEnoughGames, wilson } from "./confidence";

/** The brackets drawn left to right, lowest rank first. `all` is a pooled view and stays out of the line. */
export const CURVE_BRACKETS: Bracket[] = ["gold_minus", "platinum_plus", "emerald_plus", "diamond_plus", "master_plus"];

export type RankCurveDoc = {
  patches: string[];
  brackets: Bracket[];
  entries: { championId: number; position: string; points: ([games: number, winRate: number, pickRate: number] | null)[] }[];
};

export type CurvePoint = { bracket: Bracket; games: number; winRate: number; pickRate: number; enough: boolean };

/** One champion and role across the brackets; a bracket without games is left out. */
export function curveFor(doc: RankCurveDoc, championId: number, position: string): CurvePoint[] {
  const entry = doc.entries.find((e) => e.championId === championId && e.position === position);
  if (!entry) return [];
  return CURVE_BRACKETS.flatMap((bracket) => {
    const point = entry.points[doc.brackets.indexOf(bracket)];
    if (!point) return [];
    const [games, winRate, pickRate] = point;
    return [{ bracket, games, winRate, pickRate, enough: hasEnoughGames(games, winRate) }];
  });
}

export type CurveVerdict = "better_high" | "better_low" | null;

/**
 * A verdict only when the lowest and the highest bracket with enough games have
 * 95% intervals that do not overlap; anything closer is noise and gets no line.
 */
export function curveVerdict(points: CurvePoint[]): CurveVerdict {
  const solid = points.filter((p) => p.enough);
  if (solid.length < 2) return null;
  const low = solid[0];
  const high = solid[solid.length - 1];
  const a = wilson(low.winRate, low.games);
  const b = wilson(high.winRate, high.games);
  if (b.low > a.high) return "better_high";
  if (a.low > b.high) return "better_low";
  return null;
}
