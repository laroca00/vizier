// Stats are computed by services/crawler next to its raw games and published
// to D1's stat_docs as finished JSON; the Worker only reads them. Keys are
// shared here so both sides agree.
import { aggregateBuild, POSITIONS, type Build } from "./builds.ts";
import { arenaDuos, arenaItems, augmentChampions, augmentStats, banSuggestions, benchStats, championOverview, counters, itemTimes, laneStats, latestPatches, synergies, tierList } from "./stats.ts";

// Queues with augments: Arena and ARAM Mayhem.
export const AUGMENT_QUEUES = [1700, 2400];

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
  /** Arena duo partners for a champion. */
  duos: (championId: number) => `duos:1700:${championId}`,
  /** Arena item win rates for a champion. */
  arenaItems: (championId: number) => `arenaitems:1700:${championId}`,
  /** Lane differences against each opponent, keyed by opponent id. */
  lane: (championId: number, position: string) => `lane:${championId}:${position}`,
  /** When each finished item is usually completed, keyed by item id. */
  bench: (queue: number, championId: number, position: string) => `bench:${queue}:${championId}:${position}`,
  itemTimes: (championId: number, position: string) => `itemtimes:${championId}:${position}`,
  bans: () => "bans",
  /** One compact row per ranked champion and role, for searching builds without fetching each one. */
  buildIndex: () => "buildindex",
  /** Augment stats for a queue, overall or for one champion. */
  augments: (queue: number, championId: number | null) => `augments:${queue}:${championId ?? "ANY"}`,
  /** For each augment of a queue, the champions it does best on. */
  augmentChampions: (queue: number) => `augmentchamps:${queue}`,
};

export type BuildIndexEntry = {
  championId: number;
  position: string;
  games: number;
  winRate: number;
  keystone: number | null;
  /** Build styles with enough games, most played first. */
  styles: string[];
  /** Core items in buy order, then the most bought finished items. */
  items: number[];
};

export type BuildIndex = { patches: string[]; builds: BuildIndexEntry[] };

const INDEX_ITEMS = 8;

export function indexEntry(championId: number, position: string, build: Build): BuildIndexEntry {
  const items = [...new Set([...(build.coreItems?.ids ?? []), ...build.items.map((i) => i.id)])].slice(0, INDEX_ITEMS);
  return {
    championId,
    position,
    games: build.games,
    winRate: build.winRate,
    keystone: build.runes[0]?.perks[0] ?? null,
    styles: build.variants.map((v) => v.style),
    items,
  };
}

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
  for (const queue of AUGMENT_QUEUES) {
    yield [docKey.augments(queue, null), await augmentStats(db, queue, null)];
    yield [docKey.augmentChampions(queue), await augmentChampions(db, queue)];
  }

  const index: BuildIndexEntry[] = [];
  let indexPatches: string[] = [];
  const { results: champions } = await db
    .prepare("SELECT DISTINCT queue_id, champion_id FROM stat_counts WHERE kind = 'games'")
    .all<{ queue_id: number; champion_id: number }>();
  for (const { queue_id: queue, champion_id: championId } of champions) {
    const overview = await championOverview(db, championId, null, queue);
    if (!overview) continue;
    yield [docKey.champion(queue, championId, null), overview];
    yield [docKey.build(queue, championId, null), await aggregateBuild(db, championId, null, null, queue)];
    if (AUGMENT_QUEUES.includes(queue)) yield [docKey.augments(queue, championId), await augmentStats(db, queue, championId)];
    if (queue === 1700) {
      yield [docKey.duos(championId), await arenaDuos(db, championId)];
      yield [docKey.arenaItems(championId), await arenaItems(db, championId)];
    }
    if (queue !== RANKED) continue;

    for (const { position } of overview.positions) {
      yield [docKey.champion(queue, championId, position), await championOverview(db, championId, position, queue)];
      const build = await aggregateBuild(db, championId, position, null, queue);
      if (build && build.runes.length > 0) {
        index.push(indexEntry(championId, position, build));
        indexPatches = build.patches;
      }
      yield [docKey.build(queue, championId, position), build];
      yield [docKey.matchupBuilds(championId, position), await matchupBuilds(db, championId, position)];
      yield [docKey.counters(championId, position), await counters(db, championId, position)];
      yield [docKey.lane(championId, position), await laneStats(db, championId, position)];
      yield [docKey.itemTimes(championId, position), await itemTimes(db, championId, position)];
      if (queue === 420) yield [docKey.bench(queue, championId, position), await benchStats(db, championId, position)];
      yield [docKey.synergies(championId, position), await synergies(db, championId, position)];
    }
  }
  if (index.length > 0) yield [docKey.buildIndex(), { patches: indexPatches, builds: index } satisfies BuildIndex];
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
