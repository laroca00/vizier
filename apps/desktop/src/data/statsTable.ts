import type { BoardRow, TierEntry } from "../api";
import { hasEnoughGames } from "./confidence";

export type StatsColumn = "name" | "winRate" | "pickRate" | "banRate" | "games" | "kda" | "csPerMinute" | "goldDiff15" | "minutes" | "lateWinRate";

export const STATS_COLUMNS: StatsColumn[] = ["name", "winRate", "pickRate", "banRate", "games", "kda", "csPerMinute", "goldDiff15", "minutes", "lateWinRate"];

export type StatsRow = {
  championId: number;
  position: string;
  games: number;
  winRate: number;
  pickRate: number;
  banRate: number | null;
  /** The per-game averages; null when the crawler has none for this champion and role yet. */
  board: BoardRow | null;
};

/** One row per tier list entry, with the board's averages beside it when there are any. */
export function joinStats(position: string, champions: TierEntry[], board: { rows: BoardRow[] } | null): StatsRow[] {
  const byChampion = new Map((board?.rows ?? []).map((r) => [r.championId, r]));
  return champions.map((c) => ({
    championId: c.championId,
    position,
    games: c.games,
    winRate: c.winRate,
    pickRate: c.pickRate,
    banRate: c.banRate ?? null,
    board: byChampion.get(c.championId) ?? null,
  }));
}

/** The value a column sorts by; null sorts last in both directions. */
export function columnValue(row: StatsRow, column: Exclude<StatsColumn, "name">): number | null {
  switch (column) {
    case "winRate":
      return row.winRate;
    case "pickRate":
      return row.pickRate;
    case "banRate":
      return row.banRate;
    case "games":
      return row.games;
    case "kda":
      return row.board?.kda ?? null;
    case "csPerMinute":
      return row.board?.csPerMinute ?? null;
    case "goldDiff15":
      return row.board?.goldDiff15?.value ?? null;
    case "minutes":
      return row.board?.minutes ?? null;
    case "lateWinRate":
      return row.board?.late?.winRate ?? null;
  }
}

export type StatsView = { position: string; sort: StatsColumn; desc: boolean; minGames: number; query: string };

export const DEFAULT_STATS_VIEW: StatsView = { position: "ALL", sort: "games", desc: true, minGames: 100, query: "" };

/** Filters by games and name, then sorts; rows without the sorted value go last either way. */
export function viewStats(rows: StatsRow[], view: Pick<StatsView, "sort" | "desc" | "minGames" | "query">, nameOf: (id: number) => string): StatsRow[] {
  const query = view.query.trim().toLocaleLowerCase();
  const kept = rows.filter((r) => r.games >= view.minGames && (!query || nameOf(r.championId).toLocaleLowerCase().includes(query)));
  const sign = view.desc ? -1 : 1;
  return [...kept].sort((a, b) => {
    if (view.sort === "name") return sign * nameOf(a.championId).localeCompare(nameOf(b.championId)) || a.championId - b.championId;
    const x = columnValue(a, view.sort);
    const y = columnValue(b, view.sort);
    if (x === null && y === null) return a.championId - b.championId;
    if (x === null) return 1;
    if (y === null) return -1;
    return sign * (x - y) || a.championId - b.championId;
  });
}

/** Win rate is judged by its interval; the averages by how many games they come from. */
export const MIN_AVERAGE_GAMES = 50;
export const MIN_LANE_AVERAGE_GAMES = 30;

export const winRateSolid = (row: StatsRow) => hasEnoughGames(row.games, row.winRate);
export const averageSolid = (row: StatsRow) => (row.board?.games ?? 0) >= MIN_AVERAGE_GAMES;
export const goldDiffSolid = (row: StatsRow) => (row.board?.goldDiff15?.games ?? 0) >= MIN_LANE_AVERAGE_GAMES;
export const lateSolid = (row: StatsRow) => !!row.board?.late && hasEnoughGames(row.board.late.games, row.board.late.winRate);
