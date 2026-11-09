import { hasEnoughGames } from "../data/confidence";

/** Win rate on the newest patch and the patch before it; null when the change is unknown or the games too few. */
export function winRateShift(overview: { winRate: number; winRateChange: number | null; games: number } | null) {
  if (!overview || overview.winRateChange === null || !hasEnoughGames(overview.games, overview.winRate)) return null;
  return { before: overview.winRate - overview.winRateChange, after: overview.winRate, games: overview.games };
}
