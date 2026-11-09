import { latestPatches } from "./stats.ts";

export type Coverage = {
  /** Newest patch first. */
  patches: string[];
  /** Crawled games per patch and queue. */
  games: { patch: string; queue: number; games: number }[];
  /** Share of player rows with timeline data per patch and queue; null when there are none. */
  timeline: { patch: string; queue: number; players: number; withTimeline: number; share: number | null }[];
  /** Players the crawler follows, by region and where they were found. */
  players: { region: string; source: "ladder" | "mode"; players: number }[];
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * How much data sits behind the numbers. Region is not kept per game, so
 * regions are counted as the players the crawler follows.
 */
export async function coverage(db: D1Database): Promise<Coverage> {
  const patches = await latestPatches(db, 4);
  const games = await db
    .prepare("SELECT patch, queue_id AS queue, games FROM stat_matches ORDER BY last_start DESC")
    .all<{ patch: string; queue: number; games: number }>();
  const counts = await db
    .prepare(
      `SELECT patch, queue_id AS queue,
          SUM(CASE WHEN kind = 'games' THEN games ELSE 0 END) AS players,
          SUM(CASE WHEN kind = 'skill' THEN games ELSE 0 END) AS withTimeline
        FROM stat_counts WHERE kind IN ('games', 'skill') GROUP BY patch, queue_id`,
    )
    .all<{ patch: string; queue: number; players: number; withTimeline: number }>();
  const ladder = await db.prepare("SELECT region, COUNT(*) AS players FROM crawl_players GROUP BY region").all<{ region: string; players: number }>().catch(() => ({ results: [] }));
  const mode = await db.prepare("SELECT region, COUNT(*) AS players FROM mode_players GROUP BY region").all<{ region: string; players: number }>().catch(() => ({ results: [] }));

  const keep = new Set(patches);
  return {
    patches,
    games: games.results.filter((r) => keep.has(r.patch)),
    timeline: counts.results
      .filter((r) => keep.has(r.patch))
      .map((r) => ({ ...r, share: r.players > 0 ? round3(Math.min(1, r.withTimeline / r.players)) : null })),
    players: [
      ...ladder.results.map((r) => ({ region: r.region, source: "ladder" as const, players: r.players })),
      ...mode.results.map((r) => ({ region: r.region, source: "mode" as const, players: r.players })),
    ],
  };
}
