import { wilson } from "./confidence";
import type { TierHistoryDoc } from "./history";

export type HistoryMover = {
  championId: number;
  position: string;
  /** Games of the patch so far. */
  games: number;
  earlyGames: number;
  earlyRate: number;
  laterGames: number;
  laterRate: number;
  /** Later win rate minus earlier win rate, as a fraction. */
  change: number;
};

// Each half of the comparison needs a sample of its own, or the move is noise.
export const MIN_HALF_GAMES = 100;
const MIN_CHANGE = 0.01;
const SHOWN = 4;

/**
 * Compares the games a champion had when the patch's history began with the
 * games added since. The history rows are totals up to each day, so the later
 * half is the difference of the last and the first row and the two halves never
 * share a game. A move counts only when the 95% intervals of the halves do not
 * overlap, the same rule the elo tags use.
 */
export function historyMover(doc: TierHistoryDoc, championId: number, position: string): HistoryMover | null {
  const row = doc.champions?.[championId];
  if (!row) return null;
  const used = row.games.flatMap((g, i) => (g > 0 ? [i] : []));
  if (used.length < 2) return null;
  const first = used[0];
  const last = used[used.length - 1];
  const earlyGames = row.games[first];
  const laterGames = row.games[last] - earlyGames;
  if (earlyGames < MIN_HALF_GAMES || laterGames < MIN_HALF_GAMES) return null;
  const earlyRate = row.winRate[first];
  // Rates are stored to three decimals; the wins they imply are close enough for a half this size.
  const laterRate = (row.games[last] * row.winRate[last] - earlyGames * earlyRate) / laterGames;
  if (laterRate < 0 || laterRate > 1) return null;
  const a = wilson(earlyRate, earlyGames);
  const b = wilson(laterRate, laterGames);
  if (!(a.high < b.low || b.high < a.low)) return null;
  const change = laterRate - earlyRate;
  if (Math.abs(change) < MIN_CHANGE) return null;
  return { championId, position, games: row.games[last], earlyGames, earlyRate, laterGames, laterRate, change };
}

export type HistoryMovers = { up: HistoryMover[]; down: HistoryMover[] };

/** The clearest risers and fallers across every role's history doc. */
export function historyMovers(byRole: { position: string; doc: TierHistoryDoc | null }[]): HistoryMovers {
  const all = byRole.flatMap(({ position, doc }) =>
    doc ? Object.keys(doc.champions ?? {}).flatMap((id) => historyMover(doc, Number(id), position) ?? []) : [],
  );
  const by = (direction: 1 | -1) =>
    all
      .filter((m) => direction * m.change > 0)
      .sort((a, b) => direction * (b.change - a.change) || b.games - a.games)
      .slice(0, SHOWN);
  return { up: by(1), down: by(-1) };
}
