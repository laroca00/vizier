import type { Matchups } from "./poolCoverage";
import { hasEnoughGames, wilson } from "./data/confidence";

export const MATRIX_MAX_CHAMPIONS = 5;
export const MATRIX_OPPONENTS = 20;

export type CellState = "favourable" | "neutral" | "unfavourable" | "insufficient";
export type MatrixCell = { games: number; winRate: number; state: CellState };
export type MatrixRow = { championId: number; cells: (MatrixCell | null)[] };

/** Judged by the 95% interval, not the raw rate: a side is only named when the interval clears 50%. */
export function cellState(games: number, winRate: number): CellState {
  if (!hasEnoughGames(games, winRate)) return "insufficient";
  const { low, high } = wilson(winRate, games);
  if (low > 0.5) return "favourable";
  if (high < 0.5) return "unfavourable";
  return "neutral";
}

/** One row per champion; a null cell means the matchup list has no entry for that opponent at all. */
export function buildMatrix(championIds: number[], opponentIds: number[], matchups: Map<number, Matchups>): MatrixRow[] {
  return championIds.map((championId) => ({
    championId,
    cells: opponentIds.map((opponentId) => {
      const m = matchups.get(championId)?.find((x) => x.championId === opponentId);
      return m ? { games: m.games, winRate: m.winRate, state: cellState(m.games, m.winRate) } : null;
    }),
  }));
}

export type BlindPick = { championId: number; unfavourable: number; favourable: number; known: number; games: number };

/**
 * The champion with the fewest unfavourable cells, then the most favourable
 * ones. It needs a judgeable cell for at least half of the opponents, since a
 * champion with little data would otherwise look safe.
 */
export function bestBlind(rows: MatrixRow[]): BlindPick | null {
  let best: BlindPick | null = null;
  for (const row of rows) {
    const known = row.cells.filter((c): c is MatrixCell => c !== null && c.state !== "insufficient");
    if (known.length < row.cells.length / 2) continue;
    const pick: BlindPick = {
      championId: row.championId,
      unfavourable: known.filter((c) => c.state === "unfavourable").length,
      favourable: known.filter((c) => c.state === "favourable").length,
      known: known.length,
      games: known.reduce((sum, c) => sum + c.games, 0),
    };
    if (!best || pick.unfavourable < best.unfavourable || (pick.unfavourable === best.unfavourable && pick.favourable > best.favourable)) best = pick;
  }
  return best;
}

export const STATE_TEXT: Record<CellState, string> = {
  favourable: "Lehine",
  neutral: "Dengeli",
  unfavourable: "Aleyhine",
  insufficient: "Yetersiz veri",
};

/** A text mark next to the colour, so the table also reads without telling colours apart. */
export const STATE_MARK: Record<CellState, string> = { favourable: "▲", neutral: "●", unfavourable: "▼", insufficient: "–" };
