import { averageSolid, columnValue, goldDiffSolid, lateSolid, winRateSolid, type StatsColumn, type StatsRow } from "./statsTable";

export type Pick = { championId: number; position: string };

export const MAX_COMPARED = 3;

export type CompareStat = Exclude<StatsColumn, "name">;

/** Rows of the comparison table, in the order shown. */
export const COMPARE_STATS: CompareStat[] = ["winRate", "pickRate", "banRate", "games", "kda", "csPerMinute", "goldDiff15", "lateWinRate", "minutes"];

/** Stats where a higher number is better for the champion; the others describe how a champion plays and have no leader. */
const HIGHER_IS_BETTER: CompareStat[] = ["winRate", "kda", "csPerMinute", "goldDiff15", "lateWinRate"];

export type Cell = { value: number | null; solid: boolean; games: number | null };

/** One champion's figure for a stat in a bracket, with whether its sample carries it. */
export function compareCell(row: StatsRow | undefined, stat: CompareStat): Cell {
  if (!row) return { value: null, solid: false, games: null };
  const value = columnValue(row, stat);
  switch (stat) {
    case "winRate":
      return { value, solid: winRateSolid(row), games: row.games };
    case "pickRate":
    case "banRate":
    case "games":
      return { value, solid: row.games > 0, games: row.games };
    case "kda":
    case "csPerMinute":
    case "minutes":
      return { value, solid: averageSolid(row), games: row.board?.games ?? null };
    case "goldDiff15":
      return { value, solid: goldDiffSolid(row), games: row.board?.goldDiff15?.games ?? null };
    case "lateWinRate":
      return { value, solid: lateSolid(row), games: row.board?.late?.games ?? null };
  }
}

/**
 * The index of the champion ahead on a stat, only when two or more have a solid
 * figure and the best one is strictly ahead; ties and thin samples have no leader.
 */
export function leaderOf(cells: Cell[], stat: CompareStat): number | null {
  if (!HIGHER_IS_BETTER.includes(stat)) return null;
  const solid = cells.map((c, i) => ({ c, i })).filter(({ c }) => c.solid && c.value !== null);
  if (solid.length < 2) return null;
  const best = Math.max(...solid.map(({ c }) => c.value!));
  const top = solid.filter(({ c }) => c.value === best);
  return top.length === 1 ? top[0].i : null;
}

/** Adds a champion and role, dropping an exact repeat and keeping the newest picks when there are too many. */
export function addPick(picks: Pick[], pick: Pick): Pick[] {
  if (picks.some((p) => p.championId === pick.championId && p.position === pick.position)) return picks;
  return [...picks, pick].slice(-MAX_COMPARED);
}

