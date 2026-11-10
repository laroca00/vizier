import { hasEnoughGames } from "./confidence";

export type PatchSample = { patch: string; games: number; winRate: number };

export type PreviousPatch = PatchSample;

/**
 * In the first days of a patch a champion's new-patch sample is thin. When it
 * is, and the patch before has enough games, that patch's numbers stand in,
 * labelled "geçen yama", until the new sample passes the confidence rule.
 * Null means the numbers as sent are the ones to show.
 */
export function previousPatchBlend(byPatch: PatchSample[] | undefined): PreviousPatch | null {
  if (!byPatch || byPatch.length < 2) return null;
  const [newest, previous] = byPatch;
  if (hasEnoughGames(newest.games, newest.winRate)) return null;
  return hasEnoughGames(previous.games, previous.winRate) ? previous : null;
}
