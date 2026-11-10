import { BRACKETS, DEFAULT_BRACKET, type Bracket } from "@vizier/shared/brackets";
import { scope } from "./localSchema.ts";
import { latestPatches } from "./stats.ts";

const RANKED = 420;
// A sparkline of fewer points than this is not a trend.
export const MIN_POINTS = 3;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

/**
 * Once a UTC day, notes the counts so far of the newest patch for every
 * bracket, champion and role. A row is the patch's total up to that day, not
 * the day's own games, so each point is as solid as the sample behind it.
 * Returns the rows written (0 when today is already recorded).
 */
export async function recordHistory(db: D1Database, now = Date.now()): Promise<number> {
  const day = dayOf(now);
  const done = await db.prepare("SELECT value FROM crawl_state WHERE key = 'history_day'").first<{ value: string }>();
  if (done?.value === day) return 0;
  const [patch] = await latestPatches(db, 1);
  if (!patch) return 0;

  const insert = db.prepare(
    "INSERT OR REPLACE INTO history_points (day, patch, bracket, champion_id, team_position, games, wins, matches, bans) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const rows: D1PreparedStatement[] = [];
  for (const bracket of BRACKETS) {
    const table = scope("stat_counts", bracket);
    const matches = await db
      .prepare(`SELECT SUM(games) AS games FROM ${table} WHERE patch = ? AND queue_id = ? AND kind = 'pool-games'`)
      .bind(patch, RANKED)
      .first<{ games: number | null }>();
    if (!matches?.games) continue;
    const { results: bans } = await db
      .prepare(`SELECT champion_id, SUM(games) AS games FROM ${table} WHERE patch = ? AND queue_id = ? AND kind = 'pool-ban' GROUP BY champion_id`)
      .bind(patch, RANKED)
      .all<{ champion_id: number; games: number }>();
    const banned = new Map(bans.map((b) => [b.champion_id, b.games]));
    const { results: picks } = await db
      .prepare(`SELECT champion_id, team_position, SUM(games) AS games, SUM(wins) AS wins FROM ${table} WHERE patch = ? AND queue_id = ? AND kind = 'pool' AND team_position != '' GROUP BY champion_id, team_position`)
      .bind(patch, RANKED)
      .all<{ champion_id: number; team_position: string; games: number; wins: number }>();
    for (const p of picks) rows.push(insert.bind(day, patch, bracket, p.champion_id, p.team_position, p.games, p.wins, matches.games, banned.get(p.champion_id) ?? 0));
  }
  // Only the two newest patches are kept, like the counts they come from.
  const keep = await latestPatches(db, 2);
  const prune = db.prepare(`DELETE FROM history_points WHERE patch NOT IN (${keep.map(() => "?").join(",")})`).bind(...keep);
  await db.batch([...rows, prune, db.prepare("INSERT OR REPLACE INTO crawl_state (key, value) VALUES ('history_day', ?)").bind(day)]);
  return rows.length;
}

/** [day, games, winRate, pickRate, banRate] */
export type HistoryPoint = [string, number, number, number, number];

export type ChampionHistory = {
  fields: ["day", "games", "winRate", "pickRate", "banRate"];
  /** role → bracket → patch → points, oldest first; the counts are the patch's total up to that day. */
  roles: Record<string, Partial<Record<Bracket, Record<string, HistoryPoint[]>>>>;
};

type Row = { day: string; patch: string; bracket: Bracket; team_position: string; games: number; wins: number; matches: number; bans: number };

export const toPoint = (r: Row): HistoryPoint => [r.day, r.games, round3(r.wins / r.games), round3(r.games / r.matches), round3(r.bans / r.matches)];

export async function championHistory(db: D1Database, championId: number): Promise<ChampionHistory | null> {
  const { results } = await db
    .prepare("SELECT day, patch, bracket, team_position, games, wins, matches, bans FROM history_points WHERE champion_id = ? AND games > 0 AND matches > 0 ORDER BY day")
    .bind(championId)
    .all<Row>();
  if (results.length === 0) return null;
  const roles: ChampionHistory["roles"] = {};
  for (const r of results) {
    const byBracket = (roles[r.team_position] ??= {});
    const byPatch = (byBracket[r.bracket] ??= {});
    (byPatch[r.patch] ??= []).push(toPoint(r));
  }
  return { fields: ["day", "games", "winRate", "pickRate", "banRate"], roles };
}

/** Win rate per day of every champion in one role in the default bracket, for the tier list's small trends. */
export type TierHistory = { patch: string; days: string[]; champions: Record<number, { games: number[]; winRate: number[] }> };

export async function tierHistory(db: D1Database, position: string, bracket: Bracket = DEFAULT_BRACKET): Promise<TierHistory | null> {
  const [patch] = await latestPatches(db, 1);
  if (!patch) return null;
  const { results } = await db
    .prepare("SELECT day, champion_id, games, wins FROM history_points WHERE patch = ? AND bracket = ? AND team_position = ? AND games > 0 ORDER BY day")
    .bind(patch, bracket, position)
    .all<{ day: string; champion_id: number; games: number; wins: number }>();
  if (results.length === 0) return null;
  const days = [...new Set(results.map((r) => r.day))];
  const champions: TierHistory["champions"] = {};
  for (const r of results) {
    // One slot per day; a day without games stays 0.
    const c = (champions[r.champion_id] ??= { games: days.map(() => 0), winRate: days.map(() => 0) });
    const at = days.indexOf(r.day);
    c.games[at] = r.games;
    c.winRate[at] = round3(r.wins / r.games);
  }
  return { patch, days, champions };
}

