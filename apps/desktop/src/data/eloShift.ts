import type { Bracket } from "@vizier/shared/brackets";
import { curveVerdict, type CurvePoint, type CurveVerdict, type RankCurveDoc } from "./rankCurve";
import { hasEnoughGames } from "./confidence";

/** The two ends compared: the lowest published ladder bracket and the highest. */
export const LOW_END: Bracket = "gold_minus";
export const HIGH_END: Bracket = "master_plus";

export type EloShift = {
  championId: number;
  position: string;
  low: CurvePoint;
  high: CurvePoint;
  /** High end win rate minus low end win rate, in rate units (0.03 = 3 points). */
  change: number;
  /** Set only when the two 95% intervals do not overlap. */
  verdict: CurveVerdict;
};

/** Champions with enough games at both ends, so a shift is never a thin-sample artifact. */
export function eloShifts(doc: RankCurveDoc, options: { position: string | null; minGames: number }): EloShift[] {
  const lowIndex = doc.brackets.indexOf(LOW_END);
  const highIndex = doc.brackets.indexOf(HIGH_END);
  if (lowIndex < 0 || highIndex < 0) return [];
  const point = (bracket: Bracket, raw: RankCurveDoc["entries"][number]["points"][number]): CurvePoint | null =>
    raw ? { bracket, games: raw[0], winRate: raw[1], pickRate: raw[2], enough: hasEnoughGames(raw[0], raw[1]) } : null;
  return doc.entries.flatMap((entry) => {
    if (options.position && entry.position !== options.position) return [];
    const low = point(LOW_END, entry.points[lowIndex]);
    const high = point(HIGH_END, entry.points[highIndex]);
    if (!low || !high || !low.enough || !high.enough || low.games < options.minGames || high.games < options.minGames) return [];
    return [{ championId: entry.championId, position: entry.position, low, high, change: high.winRate - low.winRate, verdict: curveVerdict([low, high]) }];
  });
}

/** The biggest climbers first, or the biggest fallers first. */
export function sortedShifts(shifts: EloShift[], direction: "rises" | "falls"): EloShift[] {
  return [...shifts].sort((a, b) => (direction === "rises" ? b.change - a.change : a.change - b.change));
}

/** Tag text keys for rows that carry a clear verdict; null when the data does not support one. */
export const ELO_TAG_TEXT: Record<Exclude<CurveVerdict, null>, string> = {
  better_low: "Düşük elo dostu",
  better_high: "Yüksek elo ödüllendirir",
};
