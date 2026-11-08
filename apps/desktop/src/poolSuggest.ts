import { cellOf, GOOD_RATE, type Matchups } from "./poolCoverage";

export type Candidate = { championId: number; tier: string; tags: string[] };
export type Suggestion = { championId: number; tier: string; winRate: number; games: number; score: number; beats: { opponentId: number; winRate: number; games: number }[] };

// Hand-kept nudges, small next to the matchup win rate they adjust.
const TIER_BONUS: Record<string, number> = { S: 0.01, A: 0.005, B: 0, C: -0.005, D: -0.01 };
const SIMILAR_BONUS = 0.005;
// A suggestion needs rates against at least this many of the gap opponents.
const MIN_KNOWN_GAPS = 2;

/**
 * Champions that answer the opponents nobody in the pool handles. The score is
 * the games-weighted win rate against those opponents, nudged by tier and by
 * sharing a main class with a champion the player already plays.
 */
export function suggestForGaps(
  gapIds: number[],
  candidates: Candidate[],
  counters: Map<number, Matchups>,
  poolTags: string[],
  limit = 3,
): Suggestion[] {
  if (gapIds.length === 0) return [];
  const needed = Math.min(MIN_KNOWN_GAPS, gapIds.length);
  return candidates
    .flatMap((c) => {
      const cells = gapIds.flatMap((g) => {
        const cell = cellOf(c.championId, counters.get(c.championId), g);
        return cell ? [{ opponentId: g, winRate: cell.winRate, games: cell.games }] : [];
      });
      if (cells.length < needed) return [];
      const games = cells.reduce((sum, x) => sum + x.games, 0);
      const winRate = cells.reduce((sum, x) => sum + x.winRate * x.games, 0) / games;
      const score = winRate + (TIER_BONUS[c.tier] ?? 0) + (c.tags[0] && poolTags.includes(c.tags[0]) ? SIMILAR_BONUS : 0);
      return [{ championId: c.championId, tier: c.tier, winRate, games, score, beats: cells.filter((x) => x.winRate >= GOOD_RATE) }];
    })
    .sort((a, b) => b.score - a.score || b.games - a.games)
    .slice(0, limit);
}
