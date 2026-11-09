// The in-game benchmark: your CS and level against the average of ranked
// games of the same champion and role at the same minute.

export type BenchMinute = {
  minute: number;
  games: number;
  cs: number;
  level: number;
  /** Present only where enough timelines carried kills; `killParticipation` is 0 to 1. */
  kdaGames?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  killParticipation?: number;
};

/** The benchmark stops where the crawler's timelines do. */
export const BENCH_END_MINUTE = 15;

export type Expected = {
  cs: number;
  level: number;
  games: number;
  /** Average kills, deaths and assists so far, with the games behind them. */
  kda?: { kills: number; deaths: number; assists: number; games: number };
  /** Average share of team kills taken part in, 0 to 1; only between two sampled minutes. */
  kp?: { share: number; games: number };
};

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
  const mix = (a: number, b: number) => a + (b - a) * share;
  const result: Expected = {
    cs: mix(from.cs, to.cs),
    level: mix(from.level, to.level),
    // Only the sampled side's count is a real number of games.
    games: Number.isFinite(from.games) ? Math.min(from.games, to.games) : to.games,
  };
  // Minute 0 is a known start for counts, so only the later sample has to carry them.
  const start = from.minute === 0 ? { kills: 0, deaths: 0, assists: 0, kdaGames: Infinity } : from;
  if (to.kdaGames !== undefined && start.kdaGames !== undefined && to.kills !== undefined && to.deaths !== undefined && to.assists !== undefined) {
    const a = start as { kills: number; deaths: number; assists: number; kdaGames: number };
    result.kda = {
      kills: mix(a.kills, to.kills),
      deaths: mix(a.deaths, to.deaths),
      assists: mix(a.assists, to.assists),
      games: Number.isFinite(a.kdaGames) ? Math.min(a.kdaGames, to.kdaGames) : to.kdaGames,
    };
  }
  // A share has no meaningful start at minute 0, so it needs two real samples.
  if (from.killParticipation !== undefined && to.killParticipation !== undefined && from.kdaGames !== undefined && to.kdaGames !== undefined) {
    result.kp = { share: mix(from.killParticipation, to.killParticipation), games: Math.min(from.kdaGames, to.kdaGames) };
  }
  return result;
}

export type BenchRead = {
  cs: number;
  csDiff: number;
  level: number;
  levelDiff: number;
  games: number;
  kda?: { kills: number; deaths: number; assists: number; games: number };
  /** Percent of team kills: the average, yours when the team has a kill, and the difference. */
  kp?: { avg: number; own: number | null; diff: number | null; games: number };
};

const tenth = (n: number) => Math.round(n * 10) / 10;

export function benchRead(own: { cs: number; level: number; kills?: number; assists?: number; teamKills?: number }, expected: Expected): BenchRead {
  const read: BenchRead = {
    cs: Math.round(expected.cs),
    csDiff: Math.round(own.cs - expected.cs),
    level: Math.round(expected.level * 10) / 10,
    levelDiff: Math.round((own.level - expected.level) * 10) / 10,
    games: expected.games,
  };
  if (expected.kda) read.kda = { kills: tenth(expected.kda.kills), deaths: tenth(expected.kda.deaths), assists: tenth(expected.kda.assists), games: expected.kda.games };
  if (expected.kp) {
    const avg = Math.round(expected.kp.share * 100);
    // Without a team kill there is no share to compare.
    const mine = own.teamKills && own.teamKills > 0 && own.kills !== undefined && own.assists !== undefined ? Math.round(((own.kills + own.assists) / own.teamKills) * 100) : null;
    read.kp = { avg, own: mine, diff: mine === null ? null : mine - avg, games: expected.kp.games };
  }
  return read;
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
