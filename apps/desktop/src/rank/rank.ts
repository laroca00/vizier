import { BRACKETS, DEFAULT_BRACKET, isBracket, type Bracket } from "@vizier/shared/brackets";

/** What the player picked: a bracket, or "mine" for the bracket of their own rank. */
export type RankChoice = Bracket | "mine";

export const isRankChoice = (value: unknown): value is RankChoice => value === "mine" || isBracket(value);

/** Settings from older versions, or edited by hand, may hold anything; unknown values mean the default. */
export function cleanChoice(value: unknown): RankChoice {
  return isRankChoice(value) ? value : DEFAULT_BRACKET;
}

export function cleanBracket(value: unknown): Bracket | null {
  return isBracket(value) ? value : null;
}

/** "Benim rankım" falls back to Emerald+ while the player's rank isn't known. */
export function resolveBracket(choice: RankChoice, mine: Bracket | null): Bracket {
  return choice === "mine" ? (mine ?? DEFAULT_BRACKET) : choice;
}

/** The query value for a bracket; Emerald+ sends nothing so old URLs and cache entries stay the same. */
export function rankParam(bracket: Bracket): string | null {
  return bracket === DEFAULT_BRACKET ? null : bracket;
}

/** Adds `rank=` to a path that may already have a query. */
export function withRank(path: string, bracket: Bracket): string {
  const param = rankParam(bracket);
  if (!param) return path;
  return `${path}${path.includes("?") ? "&" : "?"}rank=${param}`;
}

export const RANK_CHOICES: RankChoice[] = ["mine", ...BRACKETS];
