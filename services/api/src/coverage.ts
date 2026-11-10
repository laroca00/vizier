import { BRACKETS, groupsOf, type Bracket, type TierGroup } from "@vizier/shared/brackets";
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
  /**
   * Games per rank bracket, platform and queue. Absent in docs from before the
   * all-rank crawl; games of earlier patches count as Emerald.
   */
  brackets?: { patch: string; queue: number; bracket: Bracket; platform: string; games: number }[];
  /** Share of player rows with timeline data per rank bracket; ranked solo only. */
  /** Games not counted because of a remake or a player who left, per patch; absent in older docs. */
  dropped?: { patch: string; queue: number; reason: string; games: number }[];
  /** Counted games whose roles had to be inferred, per patch; absent in older docs. */
  roleFixed?: { patch: string; queue: number; games: number }[];
  /** Last successful publish per bracket and any hold from the sanity checks; absent in older docs and outside the crawler. */
  status?: { bracket: Bracket; lastPublishAt: number | null; held: string[] }[];
  /** Ranked games played in the 24 hours before this doc was made. */
  gamesToday?: number;
  /** Counted ARAM, Mayhem and Arena games per UTC day over the last two weeks, and the mode players followed per tier group; absent in older docs. */
  modeDays?: { day: string; queue: number; games: number }[];
  modeGroups?: { group: TierGroup | null; players: number }[];
  timelineBrackets?: { patch: string; queue: number; bracket: Bracket; players: number; withTimeline: number; share: number | null }[];
};

const MODE_DAYS = 14;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * How much data sits behind the numbers. Region is not kept per game, so
 * regions are counted as the players the crawler follows.
 */
export async function coverage(db: D1Database, now = Date.now()): Promise<Coverage> {
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
  const grouped = await db
    .prepare("SELECT patch, queue_id AS queue, rank_group AS grp, kind, value, SUM(games) AS games FROM stat_counts_g WHERE kind IN ('matches', 'games', 'skill') GROUP BY patch, queue_id, rank_group, kind, value")
    .all<{ patch: string; queue: number; grp: TierGroup; kind: string; value: string; games: number }>()
    .catch(() => ({ results: [] }));
  const bracketGames = new Map<string, { patch: string; queue: number; bracket: Bracket; platform: string; games: number }>();
  const bracketTimeline = new Map<string, { patch: string; queue: number; bracket: Bracket; players: number; withTimeline: number }>();
  for (const r of grouped.results) {
    if (!keep.has(r.patch)) continue;
    for (const bracket of BRACKETS) {
      if (!groupsOf(bracket).includes(r.grp)) continue;
      if (r.kind === "matches") {
        const key = [r.patch, r.queue, bracket, r.value].join("\t");
        const row = bracketGames.get(key) ?? { patch: r.patch, queue: r.queue, bracket, platform: r.value, games: 0 };
        row.games += r.games;
        bracketGames.set(key, row);
      } else if (r.queue === 420) {
        const key = [r.patch, r.queue, bracket].join("\t");
        const row = bracketTimeline.get(key) ?? { patch: r.patch, queue: r.queue, bracket, players: 0, withTimeline: 0 };
        if (r.kind === "games") row.players += r.games;
        else row.withTimeline += r.games;
        bracketTimeline.set(key, row);
      }
    }
  }
  const droppedRows = await db
    .prepare("SELECT patch, queue_id AS queue, value AS reason, SUM(games) AS games FROM stat_counts_g WHERE kind = 'dropped' GROUP BY patch, queue_id, value")
    .all<{ patch: string; queue: number; reason: string; games: number }>()
    .catch(() => ({ results: [] }));
  const fixedRows = await db
    .prepare("SELECT patch, queue_id AS queue, SUM(games) AS games FROM stat_counts_g WHERE kind = 'role-fixed' GROUP BY patch, queue_id")
    .all<{ patch: string; queue: number; games: number }>()
    .catch(() => ({ results: [] }));
  // The crawler's own bookkeeping; the Worker's database has no such table.
  const state = await db.prepare("SELECT key, value FROM publish_state WHERE key LIKE 'last:%' OR key LIKE 'held:%'").all<{ key: string; value: string }>().catch(() => ({ results: [] }));
  const status = state.results.length === 0 ? undefined : BRACKETS.map((bracket) => {
    const last = state.results.find((r) => r.key === `last:${bracket}`);
    const held = state.results.find((r) => r.key === `held:${bracket}`);
    let problems: string[] = [];
    try {
      problems = held ? ((JSON.parse(held.value) as { problems?: string[] }).problems ?? []) : [];
    } catch {
      problems = [];
    }
    return { bracket, lastPublishAt: last ? Number(last.value) : null, held: problems };
  });
  const today = await db
    .prepare("SELECT COUNT(*) AS games FROM crawled_matches WHERE queue_id = ? AND dropped IS NULL AND game_start >= ?")
    .bind(420, now - 24 * 3_600_000)
    .first<{ games: number }>()
    .catch(() => null);
  const since = now - MODE_DAYS * 86_400_000;
  const modeDays = await db
    .prepare(
      `SELECT strftime('%Y-%m-%d', game_start / 1000, 'unixepoch') AS day, queue_id AS queue, COUNT(*) AS games
        FROM crawled_matches WHERE queue_id != 420 AND dropped IS NULL AND game_start >= ? GROUP BY day, queue_id ORDER BY day DESC, queue_id`,
    )
    .bind(since)
    .all<{ day: string; queue: number; games: number }>()
    .catch(() => ({ results: [] }));
  const modeGroups = await db
    .prepare("SELECT rank_group AS grp, COUNT(*) AS players FROM mode_players GROUP BY rank_group")
    .all<{ grp: TierGroup | null; players: number }>()
    .catch(() => ({ results: [] }));
  return {
    patches,
    ...(status ? { status } : {}),
    ...(today ? { gamesToday: today.games } : {}),
    modeDays: modeDays.results,
    modeGroups: modeGroups.results.map((r) => ({ group: r.grp, players: r.players })),
    roleFixed: fixedRows.results.filter((r) => keep.has(r.patch)),
    dropped: droppedRows.results.filter((r) => keep.has(r.patch)).sort((a, b) => a.patch.localeCompare(b.patch) * -1 || a.reason.localeCompare(b.reason)),
    games: games.results.filter((r) => keep.has(r.patch)),
    timeline: counts.results
      .filter((r) => keep.has(r.patch))
      .map((r) => ({ ...r, share: r.players > 0 ? round3(Math.min(1, r.withTimeline / r.players)) : null })),
    brackets: [...bracketGames.values()].sort((a, b) => a.patch.localeCompare(b.patch) * -1 || a.queue - b.queue || a.bracket.localeCompare(b.bracket) || a.platform.localeCompare(b.platform)),
    timelineBrackets: [...bracketTimeline.values()].map((r) => ({ ...r, share: r.players > 0 ? round3(Math.min(1, r.withTimeline / r.players)) : null })),
    players: [
      ...ladder.results.map((r) => ({ region: r.region, source: "ladder" as const, players: r.players })),
      ...mode.results.map((r) => ({ region: r.region, source: "mode" as const, players: r.players })),
    ],
  };
}
