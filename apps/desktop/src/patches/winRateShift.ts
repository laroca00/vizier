import { hasEnoughGames } from "../data/confidence";

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
