import { BRACKETS, DEFAULT_BRACKET, type Bracket } from "@vizier/shared/brackets";

/**
 * How often each bracket's docs are sent to D1, per day. The budget test
 * multiplies this by the docs a publish sends, so changing a schedule here
 * is checked against D1's free 100k row writes a day.
 */
export const PUBLISHES_PER_DAY: Record<Bracket, number> = {
  all: 1,
  gold_minus: 1,
  platinum_plus: 1,
  emerald_plus: 6,
  diamond_plus: 1,
  master_plus: 1,
};

/** Row writes the budget allows for stat docs in a day; the rest is left to the Worker, pro games and slack. */
export const DAILY_WRITE_LIMIT = 70_000;

/** A doc upsert writes its row and the index on `key`. */
export const WRITES_PER_DOC = 2;

export const publishedBrackets = (): Bracket[] => BRACKETS.filter((b) => PUBLISHES_PER_DAY[b] > 0 || b === DEFAULT_BRACKET);

/** Publishes a day of the docs for ARAM, Mayhem, Arena and URF, which no bracket applies to. */
export const OTHER_QUEUES_PER_DAY = 1;

/**
 * Share of a kind's docs that differ from the last publish. Almost everything
 * moves with every game; a build history only changes when a patch closes.
 */
export const VOLATILITY: Record<string, number> = { buildhistory: 0.1, history: 1 / 6, historytier: 1 / 6 };

/**
 * Every 4-hour publish sends Emerald+ ranked docs and at most one extra set:
 * another bracket, or the other queues. Each extra set comes round once a day,
 * the one waiting longest first, so six publishes carry five brackets and the
 * other queues. A restart only shifts the rotation.
 */
export type ExtraScope = { kind: "bracket"; bracket: Bracket } | { kind: "other" };

const EXTRA_EVERY = 24 * 3_600_000;
export const EXTRA_SCOPES: ExtraScope[] = [
  ...BRACKETS.filter((b) => b !== DEFAULT_BRACKET).map((bracket): ExtraScope => ({ kind: "bracket", bracket })),
  { kind: "other" },
];
export const scopeName = (scope: ExtraScope) => (scope.kind === "other" ? "other" : scope.bracket);

/** The extra set due now, given when each last went out (undefined = never); null if none is due. */
export function nextExtra(lastRun: (name: string) => number | undefined, now: number): ExtraScope | null {
  let best: { scope: ExtraScope; overdue: number } | null = null;
  for (const scope of EXTRA_SCOPES) {
    const last = lastRun(scopeName(scope));
    const overdue = last === undefined ? Infinity : now - last - EXTRA_EVERY;
    if (overdue >= 0 && (!best || overdue > best.overdue)) best = { scope, overdue };
  }
  return best?.scope ?? null;
}
