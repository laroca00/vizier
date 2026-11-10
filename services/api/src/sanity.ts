import type { Bracket } from "@vizier/shared/brackets";
import { scope } from "./localSchema.ts";
import { latestPatches } from "./stats.ts";

const RANKED = 420;
// Every ranked game has one winner and one loser, so the rate over all champions is 50%; a few points of drift mean games were lost on one side.
const MAX_WIN_RATE_DRIFT = 0.03;
// Ten players a game when every role was found; some games lose a few rows to missing roles.
const MIN_PLAYERS_PER_GAME = 8;
const MAX_PLAYERS_PER_GAME = 10.1;
// Counts from before games were counted per bracket have no matching game counts; above this the denominator is incomplete, not wrong.
const INCOMPLETE_DENOMINATOR = 11;
// Below this the numbers are too few to judge.
const MIN_GAMES = 1000;

export type SanityResult = { ok: boolean; problems: string[]; skipped: string[] };

/**
 * Checks a bracket's rolled-up counts before they are published: the win rate
 * over all champions, players per game, and no champion in more games than
 * were played. A failing bracket is held back by the publisher.
 */
export async function sanityChecks(db: D1Database, bracket: Bracket): Promise<SanityResult> {
  const result: SanityResult = { ok: true, problems: [], skipped: [] };
  const [patch] = await latestPatches(db, 1);
  if (!patch) return result;
  const table = scope("stat_counts", bracket);
  const fail = (problem: string) => {
    result.ok = false;
    result.problems.push(problem);
  };

  const totals = await db
    .prepare(`SELECT SUM(games) AS games, SUM(wins) AS wins FROM ${table} WHERE patch = ? AND queue_id = ? AND kind = 'games' AND team_position != ''`)
    .bind(patch, RANKED)
    .first<{ games: number | null; wins: number | null }>();
  const players = totals?.games ?? 0;
  if (players < MIN_GAMES) {
    result.skipped.push(`only ${players} player rows`);
    return result;
  }
  const rate = (totals?.wins ?? 0) / players;
  if (Math.abs(rate - 0.5) > MAX_WIN_RATE_DRIFT) fail(`win rate over all champions is ${(rate * 100).toFixed(1)}%`);

  const matches = await db
    .prepare(`SELECT SUM(games) AS games FROM ${table} WHERE patch = ? AND queue_id = ? AND kind = 'matches'`)
    .bind(patch, RANKED)
    .first<{ games: number | null }>();
  const games = matches?.games ?? 0;
  const perGame = games > 0 ? players / games : Infinity;
  if (perGame > INCOMPLETE_DENOMINATOR) {
    result.skipped.push("game counts are incomplete after the upgrade");
    return result;
  }
  if (perGame < MIN_PLAYERS_PER_GAME || perGame > MAX_PLAYERS_PER_GAME) fail(`${perGame.toFixed(2)} players a game, expected up to 10`);

  const over = await db
    .prepare(
      `SELECT champion_id, SUM(games) AS games FROM ${table} WHERE patch = ? AND queue_id = ? AND kind = 'games' AND team_position != ''
        GROUP BY champion_id HAVING SUM(games) > ? ORDER BY games DESC LIMIT 3`,
    )
    .bind(patch, RANKED, games)
    .all<{ champion_id: number; games: number }>();
  for (const r of over.results) fail(`champion ${r.champion_id} has ${r.games} games out of ${games}`);
  return result;
}
