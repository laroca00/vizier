import { DEFAULT_BRACKET, isBracket, type Bracket } from "@vizier/shared/brackets";

/** A bracket, or "mine": the player's own rank, read from the League client. */
export type RankChoice = Bracket | "mine";

export const RANK_CHOICES: RankChoice[] = ["emerald_plus", "all", "gold_minus", "platinum_plus", "diamond_plus", "master_plus", "mine"];

/** Anything stored that is not a known choice becomes the default, so a bad or older value never reaches a request. */
export function sanitizeRank(value: unknown): RankChoice {
  return value === "mine" || isBracket(value) ? value : DEFAULT_BRACKET;
}

// What requests use: set by the settings store and by the client reading (34.2); no UI imports, so api.ts can read it.
let chosen: RankChoice = DEFAULT_BRACKET;
let mine: Bracket | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

export function setRankChoice(next: RankChoice) {
  if (next === chosen) return;
  chosen = next;
  notify();
}

/** The bracket of the player's own rank; null until the client says. */
export function setMyBracket(next: Bracket | null) {
  if (next === mine) return;
  mine = next;
  notify();
}

export const subscribeRank = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const myBracket = () => mine;

/** "Mine" without a known rank falls back to Emerald+; `fellBack` lets the page say so. */
export function resolveRank(choice: RankChoice, own: Bracket | null): { bracket: Bracket; fellBack: boolean } {
  if (choice !== "mine") return { bracket: choice, fellBack: false };
  return own ? { bracket: own, fellBack: false } : { bracket: DEFAULT_BRACKET, fellBack: true };
}

/** The bracket requests use right now. */
export const activeBracket = (): Bracket => resolveRank(chosen, mine).bracket;

// Stats routes split by rank. Item times, build history and the build index are not.
const RANKED_ROUTES = [/^\/v1\/tierlist\//, /^\/v1\/builds\/\d+(\?|$)/, /^\/v1\/champions\/\d+(\?|$)/, /^\/v1\/champions\/\d+\/(counters|synergies|lane|bench)(\?|$)/];

/** Adds `rank=` to a stats route when the bracket is not Emerald+; other routes and paths that carry one are left alone. */
export function withRank(path: string, bracket: Bracket): string {
  if (bracket === DEFAULT_BRACKET || !RANKED_ROUTES.some((route) => route.test(path)) || /[?&]rank=/.test(path)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}rank=${bracket}`;
}
