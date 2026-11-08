import type { Counters } from "./api";

export type Matchups = Counters["matchups"];

/** Matchups under this many games are left out; the rate says more about luck than the champion. */
export const MIN_MATCHUP_GAMES = 30;
/** From this win rate a matchup counts as covered, below BAD_RATE it counts as a bad one. */
export const GOOD_RATE = 0.51;
export const BAD_RATE = 0.49;
export const COMMON_OPPONENTS = 20;

export type Cell = { championId: number; winRate: number; games: number };
export type Status = "covered" | "playable" | "gap" | "unknown";
export type CoverageRow = { opponentId: number; best: Cell | null; status: Status };

/** One pool champion's result against an opponent, or null when it has too few games. */
export function cellOf(championId: number, matchups: Matchups | undefined, opponentId: number): Cell | null {
  const m = matchups?.find((x) => x.championId === opponentId);
  return m && m.games >= MIN_MATCHUP_GAMES ? { championId, winRate: m.winRate, games: m.games } : null;
}

export function statusOf(best: Cell | null): Status {
  if (!best) return "unknown";
  return best.winRate >= GOOD_RATE ? "covered" : best.winRate >= BAD_RATE ? "playable" : "gap";
}

/** For each common opponent, the pool champion with the best matchup against it. */
export function coverage(opponents: number[], pool: Map<number, Matchups>): CoverageRow[] {
  return opponents.map((opponentId) => {
    let best: Cell | null = null;
    for (const [championId, matchups] of pool) {
      const cell = cellOf(championId, matchups, opponentId);
      if (cell && (!best || cell.winRate > best.winRate)) best = cell;
    }
    return { opponentId, best, status: statusOf(best) };
  });
}

/** Opponents nobody in the pool handles well: the best answer is a bad matchup, or none has data. */
export const gaps = (rows: CoverageRow[]) => rows.filter((r) => r.status === "gap" || r.status === "unknown");

export type Blind = { championId: number; bad: number; known: number; winRate: number; games: number };

/**
 * The pool champion with the fewest bad matchups among the common opponents,
 * ties broken by the average win rate. Needs rates for at least half of them.
 */
export function safestBlind(opponents: number[], pool: Map<number, Matchups>): Blind | null {
  let best: Blind | null = null;
  for (const [championId, matchups] of pool) {
    const cells = opponents.map((o) => cellOf(championId, matchups, o)).filter((c): c is Cell => c !== null);
    if (cells.length < opponents.length / 2) continue;
    const games = cells.reduce((sum, c) => sum + c.games, 0);
    const candidate: Blind = {
      championId,
      bad: cells.filter((c) => c.winRate < BAD_RATE).length,
      known: cells.length,
      winRate: cells.reduce((sum, c) => sum + c.winRate * c.games, 0) / games,
      games,
    };
    if (!best || candidate.bad < best.bad || (candidate.bad === best.bad && candidate.winRate > best.winRate)) best = candidate;
  }
  return best;
}

/** The role a pool pick is played in: its own, else the role the champion is picked in most. */
export function roleOfPick(pick: { championId: number; position: string | null }, roles: Map<number, Map<string, { pickRate: number }>>): string | null {
  if (pick.position) return pick.position;
  const own = roles.get(pick.championId);
  if (!own || own.size === 0) return null;
  return [...own.entries()].sort((a, b) => b[1].pickRate - a[1].pickRate)[0][0];
}

/** Pool champion ids per role; picks whose role can't be told are left out. */
export function poolByRole(
  pool: { championId: number; position: string | null }[],
  roles: Map<number, Map<string, { pickRate: number }>>,
): Map<string, number[]> {
  const byRole = new Map<string, number[]>();
  for (const pick of pool) {
    const role = roleOfPick(pick, roles);
    if (!role) continue;
    const list = byRole.get(role) ?? [];
    if (!list.includes(pick.championId)) byRole.set(role, [...list, pick.championId]);
  }
  return byRole;
}
