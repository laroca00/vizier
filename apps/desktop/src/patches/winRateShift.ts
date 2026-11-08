export const SHIFT_MIN_GAMES = 100;

/** Win rate on the newest patch and the patch before it; null when the change is unknown or the games too few. */
export function winRateShift(overview: { winRate: number; winRateChange: number | null; games: number } | null) {
  if (!overview || overview.winRateChange === null || overview.games < SHIFT_MIN_GAMES) return null;
  return { before: overview.winRate - overview.winRateChange, after: overview.winRate, games: overview.games };
}
