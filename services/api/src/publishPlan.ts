import { BRACKETS, DEFAULT_BRACKET, type Bracket } from "@vizier/shared/brackets";

/**
 * How often each bracket's docs are sent to D1, per day. The budget test
 * multiplies this by the docs a publish sends, so changing a schedule here
 * is checked against D1's free 100k row writes a day.
 */
export const PUBLISHES_PER_DAY: Record<Bracket, number> = {
  all: 0,
  gold_minus: 0,
  platinum_plus: 0,
  emerald_plus: 6,
  diamond_plus: 0,
  master_plus: 0,
};

/** Row writes the budget allows for stat docs in a day; the rest is left to the Worker, pro games and slack. */
export const DAILY_WRITE_LIMIT = 70_000;

/** A doc upsert writes its row and the index on `key`. */
export const WRITES_PER_DOC = 2;

export const publishedBrackets = (): Bracket[] => BRACKETS.filter((b) => PUBLISHES_PER_DAY[b] > 0 || b === DEFAULT_BRACKET);

/** Publishes a day of the docs for ARAM, Mayhem, Arena and URF, which no bracket applies to. */
export const OTHER_QUEUES_PER_DAY = 6;

/**
 * Share of a kind's docs that differ from the last publish. Almost everything
 * moves with every game; a build history only changes when a patch closes.
 */
export const VOLATILITY: Record<string, number> = { buildhistory: 0.1 };
