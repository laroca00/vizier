import type { Bracket } from "@vizier/shared/brackets";
import { DEFAULT_BRACKET } from "@vizier/shared/brackets";
import type { BenchMinute } from "./bench";

/** Games a sampled minute needs before the player's own bracket is used for the benchmark. */
export const BENCH_BRACKET_MIN_GAMES = 100;

type Doc = { minutes: BenchMinute[] };

/** True when every sampled minute has games enough; one thin minute would make part of the match unreliable. */
export const benchHasGames = (doc: Doc | null): doc is Doc =>
  doc !== null && doc.minutes.length > 0 && doc.minutes.every((m) => m.games >= BENCH_BRACKET_MIN_GAMES);

/**
 * The benchmark for the player's own bracket when it has enough games, else Emerald+. `bracket` says which one
 * the numbers are for, so the widget can name it.
 */
export function pickBench(own: Bracket | null, ownDoc: Doc | null, fallbackDoc: Doc | null): { doc: Doc; bracket: Bracket } | null {
  if (own && own !== DEFAULT_BRACKET && benchHasGames(ownDoc)) return { doc: ownDoc, bracket: own };
  return fallbackDoc ? { doc: fallbackDoc, bracket: DEFAULT_BRACKET } : null;
}
