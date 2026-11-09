// Stats are computed by services/crawler next to its raw games and published
// to D1's stat_docs as finished JSON; the Worker only reads them. Keys are
// shared here so both sides agree.
import { DEFAULT_BRACKET, REGIONS, isBracket, type Bracket, type Region } from "@vizier/shared/brackets";
import { aggregateBuild, POSITIONS, type Build } from "./builds.ts";
import { buildHistory } from "./snapshots.ts";
import { coverage } from "./coverage.ts";
import { scope } from "./localSchema.ts";
import { arenaDuos, arenaItems, augmentChampions, augmentStats, banSuggestions, benchStats, championOverview, counters, itemTimes, laneStats, latestPatches, synergies, tierList } from "./stats.ts";

// Queues with augments: Arena and ARAM Mayhem.
export const AUGMENT_QUEUES = [1700, 2400];

const RANKED = 420;
// Matchup builds need this many games, the same as aggregateBuild asks for.
const MIN_MATCHUP_GAMES = 15;
// One matchup build is ~1.5 KB; this keeps a champion's bundle well under D1's statement size.
const MAX_MATCHUP_BUILDS = 40;

const pos = (position: string | null) => position ?? "ANY";

// Emerald+ keeps the key it always had; any other bracket adds a suffix.
const RANK = ":r=";
const rank = (bracket: Bracket) => (bracket === DEFAULT_BRACKET ? "" : `${RANK}${bracket}`);

/** Splits a doc key into its Emerald+ form and the bracket it carries. */
export function splitRank(key: string): { base: string; bracket: Bracket } {
  const at = key.lastIndexOf(RANK);
  const bracket = at < 0 ? null : key.slice(at + RANK.length);
  return at >= 0 && isBracket(bracket) ? { base: key.slice(0, at), bracket } : { base: key, bracket: DEFAULT_BRACKET };
}

/** Docs of the queues without a ladder (ARAM, Mayhem, Arena, URF): no bracket applies and they move slowly. */
export function isOtherQueueKey(key: string): boolean {
  const [kind, queue] = splitRank(key).base.split(":");
  if (["augments", "augmentchamps", "duos", "arenaitems"].includes(kind)) return true;
  return ["tierlist", "champion", "build", "bench"].includes(kind) && Number(queue) !== RANKED;
}

/** Kinds that exist per bracket; ranked solo only, since other queues have no ladder of their own. */
export const BRACKET_KINDS = ["tierlist", "champion", "build", "buildvs", "counters", "synergies", "lane", "bench"] as const;

export const docKey = {
  tierList: (queue: number, position: string, bracket: Bracket = DEFAULT_BRACKET) => `tierlist:${queue}:${position}${rank(bracket)}`,
  champion: (queue: number, championId: number, position: string | null, bracket: Bracket = DEFAULT_BRACKET) =>
    `champion:${queue}:${championId}:${pos(position)}${rank(bracket)}`,
  build: (queue: number, championId: number, position: string | null, bracket: Bracket = DEFAULT_BRACKET) =>
    `build:${queue}:${championId}:${pos(position)}${rank(bracket)}`,
  /** Ranked builds for each lane opponent with enough games, keyed by opponent id. */
  matchupBuilds: (championId: number, position: string, bracket: Bracket = DEFAULT_BRACKET) => `buildvs:${championId}:${position}${rank(bracket)}`,
  counters: (championId: number, position: string, bracket: Bracket = DEFAULT_BRACKET) => `counters:${championId}:${position}${rank(bracket)}`,
  synergies: (championId: number, position: string, bracket: Bracket = DEFAULT_BRACKET) => `synergies:${championId}:${position}${rank(bracket)}`,
  /** Arena duo partners for a champion. */
  duos: (championId: number) => `duos:1700:${championId}`,
  /** Arena item win rates for a champion. */
  arenaItems: (championId: number) => `arenaitems:1700:${championId}`,
  /** Lane differences against each opponent, keyed by opponent id. */
  lane: (championId: number, position: string, bracket: Bracket = DEFAULT_BRACKET) => `lane:${championId}:${position}${rank(bracket)}`,
  /** When each finished item is usually completed, keyed by item id. */
  bench: (queue: number, championId: number, position: string, bracket: Bracket = DEFAULT_BRACKET) =>
    `bench:${queue}:${championId}:${position}${rank(bracket)}`,
  itemTimes: (championId: number, position: string) => `itemtimes:${championId}:${position}`,
  /** Compact builds of the closed patches, newest first. */
  buildHistory: (championId: number, position: string) => `buildhistory:${championId}:${position}`,
  /** A role's tier list for one region; a region without games has no doc. One doc each, to stay under D1's statement size. */
  tierRegion: (position: string, region: Region, bracket: Bracket = DEFAULT_BRACKET) => `tierregion:${RANKED}:${position}:${region}${rank(bracket)}`,
  /** A champion's overview per region and role: { ANY: { tr, euw, kr }, MIDDLE: { ... } }. */
  championRegions: (championId: number, bracket: Bracket = DEFAULT_BRACKET) => `champregions:${RANKED}:${championId}${rank(bracket)}`,
  bans: () => "bans",
  /** How many games, timelines and followed players sit behind the stats. */
  coverage: () => "coverage",
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

/**
 * Reads one doc. Object docs also carry `updatedAt` (ms): when the crawler last
 * published a changed body, so older apps simply ignore the extra field.
 */
export async function readDoc<T>(db: D1Database, key: string): Promise<T | null> {
  const row = await db.prepare("SELECT body, updated_at FROM stat_docs WHERE key = ?").bind(key).first<{ body: string; updated_at: number | null }>();
  if (!row) return null;
  const doc = JSON.parse(row.body) as T;
  if (doc && typeof doc === "object" && !Array.isArray(doc) && row.updated_at && row.updated_at > 0) {
    return { ...doc, updatedAt: row.updated_at };
  }
  return doc;
}

/**
 * Every answer the API serves from stats, as [key, value]; null values are not
 * published. With a bracket other than Emerald+, only the kinds that exist per
 * bracket (ranked solo) come out, under that bracket's keys.
 */
export async function* statDocs(db: D1Database, bracket: Bracket = DEFAULT_BRACKET): AsyncGenerator<[string, unknown]> {
  if ((await latestPatches(db)).length === 0) return;
  const main = bracket === DEFAULT_BRACKET;

  const { results: queues } = await db.prepare("SELECT DISTINCT queue_id FROM stat_matches").all<{ queue_id: number }>();
  for (const { queue_id: queue } of queues) {
    if (queue === RANKED) {
      for (const position of POSITIONS) yield [docKey.tierList(queue, position, bracket), await tierList(db, position, queue, bracket)];
    } else if (main) {
      yield [docKey.tierList(queue, "ALL"), await tierList(db, "", queue)];
    }
  }
  if (main) {
    yield [docKey.bans(), await banSuggestions(db)];
    yield [docKey.coverage(), await coverage(db)];
    for (const queue of AUGMENT_QUEUES) {
      yield [docKey.augments(queue, null), await augmentStats(db, queue, null)];
      yield [docKey.augmentChampions(queue), await augmentChampions(db, queue)];
    }
  }

  const index: BuildIndexEntry[] = [];
  let indexPatches: string[] = [];
  const { results: champions } = await db
    .prepare(`SELECT DISTINCT queue_id, champion_id FROM ${scope("stat_counts", bracket)} WHERE kind = 'games'${main ? "" : ` AND queue_id = ${RANKED}`}`)
    .all<{ queue_id: number; champion_id: number }>();
  for (const { queue_id: queue, champion_id: championId } of champions) {
    const overview = await championOverview(db, championId, null, queue, bracket);
    if (!overview) continue;
    yield [docKey.champion(queue, championId, null, bracket), overview];
    yield [docKey.build(queue, championId, null, bracket), await aggregateBuild(db, championId, null, null, queue, undefined, bracket)];
    if (main && AUGMENT_QUEUES.includes(queue)) yield [docKey.augments(queue, championId), await augmentStats(db, queue, championId)];
    if (main && queue === 1700) {
      yield [docKey.duos(championId), await arenaDuos(db, championId)];
      yield [docKey.arenaItems(championId), await arenaItems(db, championId)];
    }
    if (queue !== RANKED) continue;

    for (const { position } of overview.positions) {
      yield [docKey.champion(queue, championId, position, bracket), await championOverview(db, championId, position, queue, bracket)];
      const build = await aggregateBuild(db, championId, position, null, queue, undefined, bracket);
      if (main && build && build.runes.length > 0) {
        index.push(indexEntry(championId, position, build));
        indexPatches = build.patches;
      }
      yield [docKey.build(queue, championId, position, bracket), build];
      yield [docKey.matchupBuilds(championId, position, bracket), await matchupBuilds(db, championId, position, bracket)];
      yield [docKey.counters(championId, position, bracket), await counters(db, championId, position, bracket)];
      yield [docKey.lane(championId, position, bracket), await laneStats(db, championId, position, bracket)];
      if (main) yield [docKey.itemTimes(championId, position), await itemTimes(db, championId, position)];
      yield [docKey.bench(queue, championId, position, bracket), await benchStats(db, championId, position, bracket)];
      yield [docKey.synergies(championId, position, bracket), await synergies(db, championId, position, bracket)];
      if (main) yield [docKey.buildHistory(championId, position), await buildHistory(db, championId, position)];
    }
  }
  if (main && index.length > 0) yield [docKey.buildIndex(), { patches: indexPatches, builds: index } satisfies BuildIndex];
}

async function matchupBuilds(db: D1Database, championId: number, position: string, bracket: Bracket): Promise<Record<number, Build>> {
  const { results } = await db
    .prepare(
      `SELECT CAST(value AS INTEGER) AS opponent, SUM(games) AS games FROM ${scope("stat_counts", bracket)}
        WHERE queue_id = ? AND champion_id = ? AND team_position = ? AND kind = 'opponent'
        GROUP BY value HAVING SUM(games) >= ? ORDER BY games DESC LIMIT ?`,
    )
    .bind(RANKED, championId, position, MIN_MATCHUP_GAMES, MAX_MATCHUP_BUILDS)
    .all<{ opponent: number }>();
  const builds: Record<number, Build> = {};
  for (const { opponent } of results) {
    const build = await aggregateBuild(db, championId, position, opponent, RANKED, undefined, bracket);
    // aggregateBuild drops the matchup when the newest patches are too thin for it.
    if (build?.vs === opponent) builds[opponent] = build;
  }
  return builds;
}

/**
 * Tier lists and champion overviews split by region (TR, EUW, KR) for one
 * bracket: a tier list doc per role and region, one overview doc per champion.
 */
export async function* regionDocs(db: D1Database, bracket: Bracket): AsyncGenerator<[string, unknown]> {
  if ((await latestPatches(db)).length === 0) return;
  const at = (region: Region) => ({ bracket, region });
  for (const position of POSITIONS) {
    for (const region of REGIONS) {
      const list = await tierList(db, position, RANKED, at(region));
      if (list.games > 0) yield [docKey.tierRegion(position, region, bracket), list];
    }
  }
  const { results: champions } = await db
    .prepare(`SELECT DISTINCT champion_id FROM ${scope("stat_counts", bracket)} WHERE kind = 'games' AND queue_id = ${RANKED}`)
    .all<{ champion_id: number }>();
  for (const { champion_id: championId } of champions) {
    const roles: Record<string, Partial<Record<Region, unknown>>> = {};
    for (const region of REGIONS) {
      const overview = await championOverview(db, championId, null, RANKED, at(region));
      if (!overview) continue;
      (roles.ANY ??= {})[region] = overview;
      for (const { position } of overview.positions) (roles[position] ??= {})[region] = await championOverview(db, championId, position, RANKED, at(region));
    }
    if (Object.keys(roles).length > 0) yield [docKey.championRegions(championId, bracket), roles];
  }
}
