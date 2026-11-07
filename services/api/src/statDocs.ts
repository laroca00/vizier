// Stats are computed by services/crawler next to its raw games and published
// to D1's stat_docs as finished JSON; the Worker only reads them. Keys are
// shared here so both sides agree.
import { aggregateBuild, POSITIONS, type Build } from "./builds.ts";
import { banSuggestions, championOverview, counters, latestPatches, synergies, tierList } from "./stats.ts";

const RANKED = 420;
// Matchup builds need this many games, the same as aggregateBuild asks for.
const MIN_MATCHUP_GAMES = 15;
// One matchup build is ~1.5 KB; this keeps a champion's bundle well under D1's statement size.
const MAX_MATCHUP_BUILDS = 40;

const pos = (position: string | null) => position ?? "ANY";

export const docKey = {
  tierList: (queue: number, position: string) => `tierlist:${queue}:${position}`,
  champion: (queue: number, championId: number, position: string | null) => `champion:${queue}:${championId}:${pos(position)}`,
  build: (queue: number, championId: number, position: string | null) => `build:${queue}:${championId}:${pos(position)}`,
  /** Ranked builds for each lane opponent with enough games, keyed by opponent id. */
  matchupBuilds: (championId: number, position: string) => `buildvs:${championId}:${position}`,
  counters: (championId: number, position: string) => `counters:${championId}:${position}`,
  synergies: (championId: number, position: string) => `synergies:${championId}:${position}`,
  bans: () => "bans",
};

export async function readDoc<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db.prepare("SELECT body FROM stat_docs WHERE key = ?").bind(key).first<{ body: string }>();
  return row ? (JSON.parse(row.body) as T) : null;
}

/** Every answer the API serves from stats, as [key, value]; null values are not published. */
export async function* statDocs(db: D1Database): AsyncGenerator<[string, unknown]> {
  if ((await latestPatches(db)).length === 0) return;

  const { results: queues } = await db.prepare("SELECT DISTINCT queue_id FROM stat_matches").all<{ queue_id: number }>();
  for (const { queue_id: queue } of queues) {
    if (queue === RANKED) {
      for (const position of POSITIONS) yield [docKey.tierList(queue, position), await tierList(db, position, queue)];
    } else {
      yield [docKey.tierList(queue, "ALL"), await tierList(db, "", queue)];
    }
  }
  yield [docKey.bans(), await banSuggestions(db)];

  const { results: champions } = await db
    .prepare("SELECT DISTINCT queue_id, champion_id FROM stat_counts WHERE kind = 'games'")
    .all<{ queue_id: number; champion_id: number }>();
  for (const { queue_id: queue, champion_id: championId } of champions) {
    const overview = await championOverview(db, championId, null, queue);
    if (!overview) continue;
    yield [docKey.champion(queue, championId, null), overview];
    yield [docKey.build(queue, championId, null), await aggregateBuild(db, championId, null, null, queue)];
    if (queue !== RANKED) continue;

    for (const { position } of overview.positions) {
      yield [docKey.champion(queue, championId, position), await championOverview(db, championId, position, queue)];
      yield [docKey.build(queue, championId, position), await aggregateBuild(db, championId, position, null, queue)];
      yield [docKey.matchupBuilds(championId, position), await matchupBuilds(db, championId, position)];
      yield [docKey.counters(championId, position), await counters(db, championId, position)];
      yield [docKey.synergies(championId, position), await synergies(db, championId, position)];
    }
  }
}

async function matchupBuilds(db: D1Database, championId: number, position: string): Promise<Record<number, Build>> {
  const { results } = await db
    .prepare(
      `SELECT CAST(value AS INTEGER) AS opponent, SUM(games) AS games FROM stat_counts
        WHERE queue_id = ? AND champion_id = ? AND team_position = ? AND kind = 'opponent'
        GROUP BY value HAVING SUM(games) >= ? ORDER BY games DESC LIMIT ?`,
    )
    .bind(RANKED, championId, position, MIN_MATCHUP_GAMES, MAX_MATCHUP_BUILDS)
    .all<{ opponent: number }>();
  const builds: Record<number, Build> = {};
  for (const { opponent } of results) {
    const build = await aggregateBuild(db, championId, position, opponent, RANKED);
    // aggregateBuild drops the matchup when the newest patches are too thin for it.
    if (build?.vs === opponent) builds[opponent] = build;
  }
  return builds;
}
