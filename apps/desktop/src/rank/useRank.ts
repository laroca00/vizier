import type { Bracket } from "@vizier/shared/brackets";
import { getSettings, useSettings } from "../settings";
import { resolveBracket } from "./rank";

/** The bracket the player's stats are read for right now (their choice, with "my rank" resolved). */
export function currentBracket(): Bracket {
  const { rank, myRank } = getSettings();
  return resolveBracket(rank, myRank);
}

/** Same as currentBracket, and re-renders the caller when the choice changes, so it can go into a load key. */
export function useBracket(): Bracket {
  const { rank, myRank } = useSettings();
  return resolveBracket(rank, myRank);
}
