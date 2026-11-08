import { buildStyle, foeProfiles, type Catalog } from "./archetypes.ts";
import { maxOrder } from "./builds.ts";
import { loadCatalog } from "./ddragon.ts";

const RANKED_SOLO = 420;
const ARENA = 1700;
const CHUNK = 5000;
const CORE_ITEMS = 3;
const DAY = 86_400_000;
// Benchmarks and the CS curve need raw rows; a few days of games is plenty for them.
const RAW_DAYS = 3;
// Match ids must outlive the crawler's longest lookback (14 days for the
// other modes) so a game isn't fetched and counted twice.
const MATCH_ID_DAYS = 15;
// Followed mode players are dropped after a while so the list keeps finding active ones.
const MODE_PLAYER_DAYS = 7;

type Raw = {
  rowid: number;
  match_id: string;
  patch: string;
  queue_id: number;
  team_position: string;
  champion_id: number;
  win: number;
  runes: string;
  spells: string;
  items: string;
  start_items: string | null;
  skill_order: string | null;
  purchase_order: string | null;
  opponent_champion_id: number | null;
  team_id: number | null;
  augments: string | null;
};

type Count = { patch: string; queue: number; position: string; champion: number; kind: string; value: string; games: number; wins: number };

class Tally {
  counts = new Map<string, Count>();

  add(row: { patch: string; queue_id: number; team_position: string; champion_id: number }, kind: string, value: string, win: number) {
    const key = [row.patch, row.queue_id, row.team_position, row.champion_id, kind, value].join("\t");
    const count = this.counts.get(key) ?? {
      patch: row.patch,
      queue: row.queue_id,
      position: row.team_position,
      champion: row.champion_id,
      kind,
      value,
      games: 0,
      wins: 0,
    };
    count.games++;
    count.wins += win;
    this.counts.set(key, count);
  }
}

const ids = (csv: string) => csv.split(",").filter(Boolean).map(Number);

/**
 * Games from TR and EUW Emerald+ players. Tier lists, pick and ban rates read
 * only these, so KR Challenger games (crawled for builds) don't skew them.
 * A match id starts with the platform it was played on.
 */
export const inPool = (matchId: string) => /^(TR1|EUW1)_/.test(matchId);

// Counts that only cover the pool. `pool-games` rows sit on champion 0 and
// count matches, so ban rates have a denominator from the same games.
const POOL = "pool";
const POOL_BAN = "pool-ban";
const POOL_GAMES = "pool-games";
const matchRow = (patch: string, queue: number) => ({ patch, queue_id: queue, team_position: "", champion_id: 0 });

/** What a row adds to its champion's build, as [kind, value] pairs. */
function buildChoices(row: Raw, finished: Set<number>): [string, string][] {
  const choices: [string, string][] = [
    ["rune", row.runes],
    ["spell", row.spells],
    // An item counts once per game even when bought twice.
    ...[...new Set(ids(row.items))].map((id): [string, string] => ["item", String(id)]),
  ];
  if (!row.skill_order) return choices;
  if (row.start_items) choices.push(["start", ids(row.start_items).sort((a, b) => a - b).join(",")]);
  choices.push(["skill", `${maxOrder(row.skill_order).join("")}|${row.skill_order.slice(0, 3)}`]);
  const core: number[] = [];
  for (const id of ids(row.purchase_order ?? "")) if (finished.has(id) && !core.includes(id) && core.length < CORE_ITEMS) core.push(id);
  if (core.length === CORE_ITEMS) choices.push(["core", core.join(",")]);
  return choices;
}

async function watermark(db: D1Database, key: string) {
  const row = await db.prepare("SELECT value FROM crawl_state WHERE key = ?").bind(key).first<{ value: string }>();
  return Number(row?.value ?? 0);
}

const setWatermark = (db: D1Database, key: string, value: number) =>
  db.prepare("INSERT OR REPLACE INTO crawl_state (key, value) VALUES (?, ?)").bind(key, String(value));

function upserts(db: D1Database, tally: Tally) {
  const statement = db.prepare(
    `INSERT INTO stat_counts (patch, queue_id, team_position, champion_id, kind, value, games, wins)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET games = games + excluded.games, wins = wins + excluded.wins`,
  );
  return [...tally.counts.values()].map((c) => statement.bind(c.patch, c.queue, c.position, c.champion, c.kind, c.value, c.games, c.wins));
}

/**
 * Folds participant rows added since the last run into stat_counts. Each
 * chunk and its watermark commit together, so a crash never counts a row twice.
 */
export async function rollup(db: D1Database, catalogOf: () => Promise<Catalog> = loadCatalog): Promise<number> {
  await backfillPool(db);
  await rollupMatches(db);
  let rolled = 0;
  let catalog: Catalog | null = null;
  for (;;) {
    const from = await watermark(db, "rolled_participants");
    const { results } = await db
      .prepare(
        `SELECT rowid, match_id, patch, queue_id, team_position, champion_id, win, runes, spells, items, start_items,
            skill_order, purchase_order, opponent_champion_id, team_id, augments
          FROM participant_stats WHERE rowid > ? ORDER BY rowid LIMIT ?`,
      )
      .bind(from, CHUNK)
      .all<Raw>();
    if (results.length === 0) return rolled;
    // A game's rows are written in one batch, so only a full chunk can end mid-game.
    let rows = results;
    if (results.length === CHUNK) {
      const last = results[results.length - 1].match_id;
      rows = results.filter((r) => r.match_id !== last);
    }
    catalog ??= await catalogOf();

    const tally = new Tally();
    const teams = new Map<string, Raw[]>();
    const duos = new Map<string, Raw[]>();
    for (const row of rows) {
      tally.add(row, "games", "", row.win);
      if (inPool(row.match_id)) tally.add(row, POOL, "", row.win);
      const choices = buildChoices(row, catalog.finished);
      for (const [kind, value] of choices) tally.add(row, kind, value, row.win);
      // Each build style gets its own runes, items and skills: AP Kai'Sa is not crit Kai'Sa.
      const style = buildStyle(ids(row.items), catalog);
      if (style) {
        tally.add(row, "style", style, row.win);
        for (const [kind, value] of choices) tally.add(row, `s-${kind}`, `${style}|${value}`, row.win);
      }
      if (row.queue_id === RANKED_SOLO && row.opponent_champion_id) {
        const opponent = row.opponent_champion_id;
        tally.add(row, "opponent", String(opponent), row.win);
        for (const [kind, value] of choices) tally.add(row, `vs-${kind}`, `${opponent}|${value}`, row.win);
      }
      if (row.augments) {
        tally.add(row, "augmented", "", row.win);
        for (const id of new Set(ids(row.augments))) tally.add(row, "augment", String(id), row.win);
      }
      if (row.queue_id === RANKED_SOLO && row.team_id !== null) {
        const team = `${row.match_id}:${row.team_id}`;
        teams.set(team, [...(teams.get(team) ?? []), row]);
      }
      if (row.queue_id === ARENA && row.team_id !== null) {
        const duo = `${row.match_id}:${row.team_id}`;
        duos.set(duo, [...(duos.get(duo) ?? []), row]);
      }
    }
    // Both players share the placement, so a duo's win is each one's own win.
    for (const duo of duos.values()) {
      if (duo.length !== 2) continue;
      tally.add(duo[0], "duo", String(duo[1].champion_id), duo[0].win);
      tally.add(duo[1], "duo", String(duo[0].champion_id), duo[1].win);
    }
    for (const [key, team] of teams) {
      const [match, side] = key.split(":");
      const enemies = (teams.get(`${match}:${side === "100" ? 200 : 100}`) ?? []).map((r) => r.champion_id);
      const foes = foeProfiles(enemies, catalog);
      for (const me of team) {
        for (const ally of team) if (ally !== me) tally.add(me, "ally", `${ally.champion_id}:${ally.team_position}`, me.win);
        // Items bought against magic-heavy, physical-heavy or tanky teams, for situational picks.
        for (const foe of foes) {
          tally.add(me, "foe", foe, me.win);
          for (const id of new Set(ids(me.items))) tally.add(me, "foe-item", `${foe}|${id}`, me.win);
        }
      }
    }
    await db.batch([...upserts(db, tally), setWatermark(db, "rolled_participants", rows[rows.length - 1].rowid)]);
    rolled += rows.length;
  }
}

type MatchRow = { rowid: number; match_id: string; patch: string; queue_id: number; game_start: number; bans: string | null };

function tallyPoolMatches(tally: Tally, matches: MatchRow[]) {
  for (const m of matches) {
    if (!inPool(m.match_id)) continue;
    tally.add(matchRow(m.patch, m.queue_id), POOL_GAMES, "", 0);
    for (const id of new Set(ids(m.bans ?? ""))) tally.add({ ...matchRow(m.patch, m.queue_id), champion_id: id }, POOL_BAN, "", 0);
  }
}

/**
 * The pool counts arrived after games were already rolled up. Once, count
 * the pool from the raw rows still kept (a few days' worth), so tier lists
 * don't start empty. Later rows are counted by the normal rollup.
 */
async function backfillPool(db: D1Database) {
  if (await watermark(db, "pool_backfilled")) return;
  const [participants, matches] = await Promise.all([watermark(db, "rolled_participants"), watermark(db, "rolled_matches")]);
  const tally = new Tally();
  const { results: rows } = await db
    .prepare("SELECT match_id, patch, queue_id, team_position, champion_id, win FROM participant_stats WHERE rowid <= ?")
    .bind(participants)
    .all<{ match_id: string; patch: string; queue_id: number; team_position: string; champion_id: number; win: number }>();
  for (const row of rows) if (inPool(row.match_id)) tally.add(row, POOL, "", row.win);
  const { results: games } = await db
    .prepare("SELECT rowid, match_id, patch, queue_id, game_start, bans FROM crawled_matches WHERE rowid <= ?")
    .bind(matches)
    .all<MatchRow>();
  tallyPoolMatches(tally, games);
  // One batch, flag included, so a crash can't count the backfill twice.
  await db.batch([...upserts(db, tally), setWatermark(db, "pool_backfilled", 1)]);
}

/** Game counts per patch and queue, and ranked bans. */
async function rollupMatches(db: D1Database) {
  const from = await watermark(db, "rolled_matches");
  const { results } = await db
    .prepare("SELECT rowid, match_id, patch, queue_id, game_start, bans FROM crawled_matches WHERE rowid > ? ORDER BY rowid")
    .bind(from)
    .all<MatchRow>();
  if (results.length === 0) return;

  const games = new Map<string, { patch: string; queue: number; games: number; last: number }>();
  const tally = new Tally();
  for (const m of results) {
    const key = `${m.patch}\t${m.queue_id}`;
    const g = games.get(key) ?? { patch: m.patch, queue: m.queue_id, games: 0, last: 0 };
    g.games++;
    g.last = Math.max(g.last, m.game_start);
    games.set(key, g);
    for (const id of new Set(ids(m.bans ?? ""))) tally.add({ patch: m.patch, queue_id: m.queue_id, team_position: "", champion_id: id }, "ban", "", 0);
  }
  tallyPoolMatches(tally, results);
  const insertGames = db.prepare(
    `INSERT INTO stat_matches (patch, queue_id, games, last_start) VALUES (?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET games = games + excluded.games, last_start = MAX(last_start, excluded.last_start)`,
  );
  await db.batch([
    ...[...games.values()].map((g) => insertGames.bind(g.patch, g.queue, g.games, g.last)),
    ...upserts(db, tally),
    setWatermark(db, "rolled_matches", results[results.length - 1].rowid),
  ]);
}

/**
 * Deletes raw rows once they are rolled up and a few days old, and counts
 * for patches older than the two newest.
 */
export async function pruneRaw(db: D1Database, now = Date.now()) {
  const [participants, matches] = await Promise.all([watermark(db, "rolled_participants"), watermark(db, "rolled_matches")]);
  await db.batch([
    db
      .prepare(
        `DELETE FROM participant_stats WHERE rowid <= ?
          AND match_id IN (SELECT match_id FROM crawled_matches WHERE game_start < ?)`,
      )
      .bind(participants, now - RAW_DAYS * DAY),
    db.prepare("DELETE FROM crawled_matches WHERE rowid <= ? AND game_start < ?").bind(matches, now - MATCH_ID_DAYS * DAY),
    db.prepare("DELETE FROM mode_players WHERE added_at < ?").bind(now - MODE_PLAYER_DAYS * DAY),
  ]);
  const { results } = await db
    .prepare("SELECT patch FROM stat_matches GROUP BY patch ORDER BY MAX(last_start) DESC LIMIT 2")
    .all<{ patch: string }>();
  if (results.length < 2) return;
  const keep = results.map((r) => r.patch);
  await db.batch([
    db.prepare("DELETE FROM stat_counts WHERE patch NOT IN (?, ?)").bind(...keep),
    db.prepare("DELETE FROM stat_matches WHERE patch NOT IN (?, ?)").bind(...keep),
  ]);
}
