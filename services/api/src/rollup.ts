import { buildStyle, foeProfiles, type Catalog } from "./archetypes.ts";
import { maxOrder, parseRuneKey } from "./builds.ts";
import { loadCatalog } from "./ddragon.ts";
import { regionKind, regionOfMatch } from "@vizier/shared/brackets";
import { LEGACY_GROUP } from "./localSchema.ts";
import { decodeKda } from "./timeline.ts";

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
  cs_minutes: string | null;
  gold10: number | null;
  gold15: number | null;
  first_blood: number | null;
  purchase_times: string | null;
  level_minutes: string | null;
  kda_minutes: string | null;
  rank_group: string | null;
};

/** Rows from before groups were kept count as Emerald. */
const groupOf = (row: { rank_group: string | null }) => row.rank_group ?? LEGACY_GROUP;

type Count = { group: string; patch: string; queue: number; position: string; champion: number; kind: string; value: string; games: number; wins: number };

type LaneSum = { group: string; patch: string; position: string; champion: number; opponent: number; games: number; cs10: number; cs15: number; gold10: number; gold15: number; firstBloods: number };

/** Both laners need timeline data, or the difference means nothing. */
function laneDifference(me: Raw, foe: Raw): Omit<LaneSum, "group" | "patch" | "position" | "champion" | "opponent" | "games"> | null {
  if (me.gold10 === null || me.gold15 === null || foe.gold10 === null || foe.gold15 === null) return null;
  const mine = ids(me.cs_minutes ?? "");
  const theirs = ids(foe.cs_minutes ?? "");
  if (mine.length < 15 || theirs.length < 15) return null;
  return {
    cs10: mine[9] - theirs[9],
    cs15: mine[14] - theirs[14],
    gold10: me.gold10 - foe.gold10,
    gold15: me.gold15 - foe.gold15,
    firstBloods: me.first_blood ?? 0,
  };
}

function addLane(sums: Map<string, LaneSum>, me: Raw, foe: Raw) {
  const diff = laneDifference(me, foe);
  if (!diff) return;
  const key = [groupOf(me), me.patch, me.team_position, me.champion_id, foe.champion_id].join("\t");
  const sum = sums.get(key) ?? { group: groupOf(me), patch: me.patch, position: me.team_position, champion: me.champion_id, opponent: foe.champion_id, games: 0, cs10: 0, cs15: 0, gold10: 0, gold15: 0, firstBloods: 0 };
  sum.games++;
  for (const field of ["cs10", "cs15", "gold10", "gold15", "firstBloods"] as const) sum[field] += diff[field];
  sums.set(key, sum);
}

function laneUpserts(db: D1Database, sums: Map<string, LaneSum>) {
  const statement = db.prepare(
    `INSERT INTO lane_sums_g (rank_group, patch, team_position, champion_id, opponent_id, games, cs10, cs15, gold10, gold15, first_bloods)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET games = games + excluded.games, cs10 = cs10 + excluded.cs10, cs15 = cs15 + excluded.cs15,
        gold10 = gold10 + excluded.gold10, gold15 = gold15 + excluded.gold15, first_bloods = first_bloods + excluded.first_bloods`,
  );
  return [...sums.values()].map((l) => statement.bind(l.group, l.patch, l.position, l.champion, l.opponent, l.games, l.cs10, l.cs15, l.gold10, l.gold15, l.firstBloods));
}

/** Minutes the benchmark keeps; the app interpolates between them. */
export const BENCH_MINUTES = [3, 5, 8, 10, 12, 15];

type BenchSum = { group: string; patch: string; position: string; champion: number; minute: number; games: number; cs: number; level: number; kdaGames: number; kills: number; deaths: number; assists: number; teamKills: number };

/** CS and level at the sample minutes, for ranked games whose timeline covered all 15. */
export function addBench(sums: Map<string, BenchSum>, row: Raw) {
  if (!row.team_position || row.queue_id !== RANKED_SOLO || !row.cs_minutes || !row.level_minutes) return;
  const cs = ids(row.cs_minutes);
  const level = ids(row.level_minutes);
  const kda = decodeKda(row.kda_minutes);
  if (cs.length < 15 || level.length < 15) return;
  for (const minute of BENCH_MINUTES) {
    const key = [groupOf(row), row.patch, row.team_position, row.champion_id, minute].join("\t");
    const sum = sums.get(key) ?? { group: groupOf(row), patch: row.patch, position: row.team_position, champion: row.champion_id, minute, games: 0, cs: 0, level: 0, kdaGames: 0, kills: 0, deaths: 0, assists: 0, teamKills: 0 };
    sum.games++;
    sum.cs += cs[minute - 1];
    sum.level += level[minute - 1];
    // Rows from before the series was kept still count for CS and level.
    const point = kda.length >= 15 ? kda[minute - 1] : undefined;
    if (point) {
      sum.kdaGames++;
      sum.kills += point.kills;
      sum.deaths += point.deaths;
      sum.assists += point.assists;
      sum.teamKills += point.teamKills;
    }
    sums.set(key, sum);
  }
}

function benchUpserts(db: D1Database, sums: Map<string, BenchSum>) {
  const statement = db.prepare(
    `INSERT INTO bench_sums_g (rank_group, patch, team_position, champion_id, minute, games, cs, level, kda_games, kills, deaths, assists, team_kills)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET games = games + excluded.games, cs = cs + excluded.cs, level = level + excluded.level,
        kda_games = kda_games + excluded.kda_games, kills = kills + excluded.kills, deaths = deaths + excluded.deaths,
        assists = assists + excluded.assists, team_kills = team_kills + excluded.team_kills`,
  );
  return [...sums.values()].map((b) => statement.bind(b.group, b.patch, b.position, b.champion, b.minute, b.games, b.cs, b.level, b.kdaGames, b.kills, b.deaths, b.assists, b.teamKills));
}

type ItemTime = { group: string; patch: string; position: string; champion: number; item: number; games: number; seconds: number };

/** The first time each finished item was bought, as seconds into the game. */
function addItemTimes(sums: Map<string, ItemTime>, row: Raw, finished: Set<number>) {
  if (!row.team_position || row.queue_id !== RANKED_SOLO || !row.purchase_times) return;
  const bought = ids(row.purchase_order ?? "");
  const times = ids(row.purchase_times);
  const seen = new Set<number>();
  bought.forEach((item, at) => {
    if (!finished.has(item) || seen.has(item) || times[at] === undefined) return;
    seen.add(item);
    const key = [groupOf(row), row.patch, row.team_position, row.champion_id, item].join("\t");
    const sum = sums.get(key) ?? { group: groupOf(row), patch: row.patch, position: row.team_position, champion: row.champion_id, item, games: 0, seconds: 0 };
    sum.games++;
    sum.seconds += times[at];
    sums.set(key, sum);
  });
}

function itemTimeUpserts(db: D1Database, sums: Map<string, ItemTime>) {
  const statement = db.prepare(
    `INSERT INTO item_time_sums_g (rank_group, patch, team_position, champion_id, item_id, games, seconds) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET games = games + excluded.games, seconds = seconds + excluded.seconds`,
  );
  return [...sums.values()].map((s) => statement.bind(s.group, s.patch, s.position, s.champion, s.item, s.games, s.seconds));
}

class Tally {
  counts = new Map<string, Count>();

  add(row: { rank_group: string | null; patch: string; queue_id: number; team_position: string; champion_id: number }, kind: string, value: string, win: number) {
    const key = [groupOf(row), row.patch, row.queue_id, row.team_position, row.champion_id, kind, value].join("\t");
    const count = this.counts.get(key) ?? {
      group: groupOf(row),
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
// Region counts are ranked solo only, for ?region= on tier lists. KR counts here although the pool leaves it out.
const matchRow = (m: { patch: string; queue_id: number; rank_group: string | null }) => ({ rank_group: m.rank_group, patch: m.patch, queue_id: m.queue_id, team_position: "", champion_id: 0 });

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
    `INSERT INTO stat_counts_g (rank_group, patch, queue_id, team_position, champion_id, kind, value, games, wins)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET games = games + excluded.games, wins = wins + excluded.wins`,
  );
  return [...tally.counts.values()].map((c) => statement.bind(c.group, c.patch, c.queue, c.position, c.champion, c.kind, c.value, c.games, c.wins));
}

/**
 * Folds participant rows added since the last run into stat_counts. Each
 * chunk and its watermark commit together, so a crash never counts a row twice.
 */
export async function rollup(db: D1Database, catalogOf: () => Promise<Catalog> = loadCatalog): Promise<number> {
  await backfillPool(db);
  await backfillRegions(db);
  await rollupMatches(db);
  let rolled = 0;
  let catalog: Catalog | null = null;
  for (;;) {
    const from = await watermark(db, "rolled_participants");
    const { results } = await db
      .prepare(
        `SELECT rowid, match_id, patch, queue_id, team_position, champion_id, win, runes, spells, items, start_items,
            skill_order, purchase_order, opponent_champion_id, team_id, augments, cs_minutes, gold10, gold15, first_blood, purchase_times, level_minutes, kda_minutes, rank_group
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
    const lanes = new Map<string, LaneSum>();
    const itemTimes = new Map<string, ItemTime>();
    const bench = new Map<string, BenchSum>();
    for (const row of rows) {
      tally.add(row, "games", "", row.win);
      if (inPool(row.match_id)) tally.add(row, POOL, "", row.win);
      const region = regionOfMatch(row.match_id);
      if (region && row.queue_id === RANKED_SOLO) tally.add(row, regionKind(POOL, region), "", row.win);
      const choices = buildChoices(row, catalog.finished);
      addItemTimes(itemTimes, row, catalog.finished);
      addBench(bench, row);
      for (const [kind, value] of choices) tally.add(row, kind, value, row.win);
      // Single runes, for pick rates inside a rune page.
      // Perk 0 counts the games these rows come from; older games were rolled up before single runes were counted.
      if (row.runes) for (const id of new Set([0, ...parseRuneKey(row.runes).perks])) tally.add(row, "perk", String(id), row.win);
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
      const enemyRows = teams.get(`${match}:${side === "100" ? 200 : 100}`) ?? [];
      const enemies = enemyRows.map((r) => r.champion_id);
      for (const me of team) {
        const foe = enemyRows.find((r) => r.team_position === me.team_position);
        if (foe) addLane(lanes, me, foe);
      }
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
    await db.batch([...upserts(db, tally), ...laneUpserts(db, lanes), ...itemTimeUpserts(db, itemTimes), ...benchUpserts(db, bench), setWatermark(db, "rolled_participants", rows[rows.length - 1].rowid)]);
    rolled += rows.length;
  }
}

type MatchRow = { rank_group: string | null; rowid: number; match_id: string; patch: string; queue_id: number; game_start: number; bans: string | null };

function tallyPoolMatches(tally: Tally, matches: MatchRow[]) {
  for (const m of matches) {
    const region = m.queue_id === RANKED_SOLO ? regionOfMatch(m.match_id) : null;
    if (region) {
      tally.add(matchRow(m), regionKind(POOL_GAMES, region), "", 0);
      for (const id of new Set(ids(m.bans ?? ""))) tally.add({ ...matchRow(m), champion_id: id }, regionKind(POOL_BAN, region), "", 0);
    }
    if (!inPool(m.match_id)) continue;
    tally.add(matchRow(m), POOL_GAMES, "", 0);
    for (const id of new Set(ids(m.bans ?? ""))) tally.add({ ...matchRow(m), champion_id: id }, POOL_BAN, "", 0);
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
    .prepare("SELECT match_id, patch, queue_id, team_position, champion_id, win, rank_group FROM participant_stats WHERE rowid <= ?")
    .bind(participants)
    .all<{ match_id: string; patch: string; queue_id: number; team_position: string; champion_id: number; win: number; rank_group: string | null }>();
  for (const row of rows) if (inPool(row.match_id)) tally.add(row, POOL, "", row.win);
  const { results: games } = await db
    .prepare("SELECT rowid, match_id, patch, queue_id, game_start, bans, rank_group FROM crawled_matches WHERE rowid <= ?")
    .bind(matches)
    .all<MatchRow>();
  tallyPoolMatches(tally, games);
  // One batch, flag included, so a crash can't count the backfill twice.
  await db.batch([...upserts(db, tally), setWatermark(db, "pool_backfilled", 1)]);
}

/**
 * Region counts arrived after games were already rolled up. Once, count them
 * from the raw rows still kept, so the first region lists are not empty.
 * Pool counts are not touched.
 */
async function backfillRegions(db: D1Database) {
  if (await watermark(db, "regions_backfilled")) return;
  const [participants, matches] = await Promise.all([watermark(db, "rolled_participants"), watermark(db, "rolled_matches")]);
  const tally = new Tally();
  const { results: rows } = await db
    .prepare("SELECT match_id, patch, queue_id, team_position, champion_id, win, rank_group FROM participant_stats WHERE rowid <= ? AND queue_id = ?")
    .bind(participants, RANKED_SOLO)
    .all<{ match_id: string; patch: string; queue_id: number; team_position: string; champion_id: number; win: number; rank_group: string | null }>();
  for (const row of rows) {
    const region = regionOfMatch(row.match_id);
    if (region) tally.add(row, regionKind(POOL, region), "", row.win);
  }
  const { results: games } = await db
    .prepare("SELECT rowid, match_id, patch, queue_id, game_start, bans, rank_group FROM crawled_matches WHERE rowid <= ? AND queue_id = ?")
    .bind(matches, RANKED_SOLO)
    .all<MatchRow>();
  for (const m of games) {
    const region = regionOfMatch(m.match_id);
    if (!region) continue;
    tally.add(matchRow(m), regionKind(POOL_GAMES, region), "", 0);
    for (const id of new Set(ids(m.bans ?? ""))) tally.add({ ...matchRow(m), champion_id: id }, regionKind(POOL_BAN, region), "", 0);
  }
  await db.batch([...upserts(db, tally), setWatermark(db, "regions_backfilled", 1)]);
}

/** Game counts per patch and queue, and ranked bans. */
async function rollupMatches(db: D1Database) {
  const from = await watermark(db, "rolled_matches");
  const { results } = await db
    .prepare("SELECT rowid, match_id, patch, queue_id, game_start, bans, rank_group FROM crawled_matches WHERE rowid > ? ORDER BY rowid")
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
    for (const id of new Set(ids(m.bans ?? ""))) tally.add({ ...matchRow(m), champion_id: id }, "ban", "", 0);
  }
  tallyPoolMatches(tally, results);
  // Games per tier group and platform, for the coverage doc: the prefix of a match id is where it was played.
  for (const m of results) tally.add(matchRow(m), "matches", m.match_id.split("_")[0], 0);
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
    db.prepare("DELETE FROM stat_counts_g WHERE patch NOT IN (?, ?)").bind(...keep),
    db.prepare("DELETE FROM stat_matches WHERE patch NOT IN (?, ?)").bind(...keep),
    db.prepare("DELETE FROM lane_sums_g WHERE patch NOT IN (?, ?)").bind(...keep),
    db.prepare("DELETE FROM item_time_sums_g WHERE patch NOT IN (?, ?)").bind(...keep),
    db.prepare("DELETE FROM bench_sums_g WHERE patch NOT IN (?, ?)").bind(...keep),
  ]);
}
