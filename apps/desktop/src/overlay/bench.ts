// The in-game benchmark: your CS and level against the average of ranked
// games of the same champion and role at the same minute.

export type BenchMinute = { minute: number; games: number; cs: number; level: number };

/** The benchmark stops where the crawler's timelines do. */
export const BENCH_END_MINUTE = 15;

export type Expected = { cs: number; level: number; games: number };

/**
 * Interpolates between the sample minutes. Minute 0 is a known start (no CS,
 * level 1), so the first minutes need no sample of their own.
 */
export function expectedAt(minutes: BenchMinute[], at: number): Expected | null {
  if (minutes.length === 0 || at < 0 || at > BENCH_END_MINUTE) return null;
  const points = [{ minute: 0, games: Infinity, cs: 0, level: 1 }, ...[...minutes].sort((a, b) => a.minute - b.minute)];
  const upper = points.findIndex((p) => p.minute >= at);
  if (upper === -1) return null;
  const to = points[upper];
  const from = points[Math.max(0, upper - 1)];
  const share = to.minute === from.minute ? 1 : (at - from.minute) / (to.minute - from.minute);
  return {
    cs: from.cs + (to.cs - from.cs) * share,
    level: from.level + (to.level - from.level) * share,
    // Only the sampled side's count is a real number of games.
    games: Number.isFinite(from.games) ? Math.min(from.games, to.games) : to.games,
  };
}

export type BenchRead = { cs: number; csDiff: number; level: number; levelDiff: number; games: number };

export function benchRead(own: { cs: number; level: number }, expected: Expected): BenchRead {
  return {
    cs: Math.round(expected.cs),
    csDiff: Math.round(own.cs - expected.cs),
    level: Math.round(expected.level * 10) / 10,
    levelDiff: Math.round((own.level - expected.level) * 10) / 10,
    games: expected.games,
  };
}

const HISTORY_STEP = 10;

/** One CS difference per ten seconds of game time, kept for the sparkline. */
export function pushHistory(history: { at: number; diff: number }[], at: number, diff: number): { at: number; diff: number }[] {
  const last = history[history.length - 1];
  // The clock going back means a new game.
  if (last && at < last.at) return [{ at, diff }];
  if (last && at - last.at < HISTORY_STEP) return history;
  return [...history, { at, diff }].slice(-90);
}

/** SVG polyline points for a series, scaled into the box; flat at the middle when nothing varies. */
export function sparkline(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const max = Math.max(...values.map(Math.abs), 1);
  return values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height / 2 - (v / max) * (height / 2 - 1)).toFixed(1)}`).join(" ");
}
