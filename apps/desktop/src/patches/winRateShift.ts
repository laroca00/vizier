import { hasEnoughGames, wilson } from "../data/confidence";

type Overview = { patchRates?: { patch: string; games: number; winRate: number }[] };

export type Shift = { before: number; after: number; beforeGames: number; afterGames: number; beforePatch: string; afterPatch: string };

/**
 * Win rate on the newest patch against the patch before it, each with its own
 * games. Null until both patches have a sample the confidence rule accepts, so
 * the first days of a patch show nothing instead of a swing from a few games.
 */
export function winRateShift(overview: Overview | null): Shift | null {
  const [after, before] = overview?.patchRates ?? [];
  if (!after || !before || !hasEnoughGames(after.games, after.winRate) || !hasEnoughGames(before.games, before.winRate)) return null;
  return { before: before.winRate, after: after.winRate, beforeGames: before.games, afterGames: after.games, beforePatch: before.patch, afterPatch: after.patch };
}

// Smaller moves than a point are not worth a line on Home.
const MIN_CLEAR_CHANGE = 0.01;

/** "rose" or "fell" only when the two patches' intervals do not overlap, the rule the elo tags use. */
export function clearDirection(shift: Shift | null): "rose" | "fell" | null {
  if (!shift || Math.abs(shift.after - shift.before) < MIN_CLEAR_CHANGE) return null;
  const a = wilson(shift.before, shift.beforeGames);
  const b = wilson(shift.after, shift.afterGames);
  if (b.low > a.high) return "rose";
  if (b.high < a.low) return "fell";
  return null;
}
