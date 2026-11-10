import { difficultyOf, type Difficulty } from "../draft/logic";
import { phaseRates, type LengthBucket } from "./lengthStats";

export type LengthRead = { early: Difficulty; late: Difficulty };

/**
 * How a matchup changes with the length of the game: short games (under 25
 * minutes) against long ones (30 minutes or more). A read only exists when
 * both sides have a judgeable sample and they disagree about who is ahead
 * ("hard" and "easy" need the 95% interval fully on one side of 50%).
 */
export function lengthRead(lengths: LengthBucket[] | undefined): LengthRead | null {
  const rates = phaseRates(lengths);
  const long = (lengths ?? []).filter((l) => l.bucket >= 3);
  const longGames = long.reduce((sum, l) => sum + l.games, 0);
  if (!rates.early || longGames === 0) return null;
  const late = { games: longGames, winRate: long.reduce((sum, l) => sum + l.games * l.winRate, 0) / longGames };
  const early = difficultyOf(rates.early.winRate, rates.early.games);
  const after = difficultyOf(late.winRate, late.games);
  return early !== "even" && after !== "even" && early !== after ? { early, late: after } : null;
}

/** The plain line for a read, or null. */
export function lengthLine(read: LengthRead | null): "hardThenEasy" | "easyThenHard" | null {
  if (!read) return null;
  return read.early === "hard" ? "hardThenEasy" : "easyThenHard";
}
