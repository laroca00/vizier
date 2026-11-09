// Aggregates over the crawler's rolled-up counts in stat_counts: tier lists,
// champion pages, matchups, synergies and bans, over the two newest stored
// patches. Tier lists, pick and ban rates read only the TR and EUW Emerald+
// pool (kinds "pool", "pool-ban", "pool-games"); builds and matchups use
// every crawled game.

<<<<<<< HEAD
import { DEFAULT_BRACKET, type Bracket } from "@vizier/shared/brackets";
import { scope, type Where } from "./localSchema.ts";
=======
import { BRACKETS, DEFAULT_BRACKET, groupsOf, regionKind, type Bracket, type Region, type TierGroup } from "@vizier/shared/brackets";
import { scope } from "./localSchema.ts";
>>>>>>> auto/33-rank-api

// Shrinks small samples towards 50% so a 3-0 champion doesn't top the list.
export const sampleLimits = {
  // Win rates are pulled towards 50% as if every champion had this many more
  // games at even odds, so 17 games at 76% can't outrank 400 at 54%.
  priorGames: 200,
  // Tiers pull harder: a few hundred lucky games shouldn't make a champion S.
  tierPriorGames: 1500,
  // A champion is ranked in a role only from this many games; below it the rate is mostly luck.
  tierGames: 100,
  // The tier list shows champions from this many games, flagged by the app while under tierGames.
  listGames: 30,
  // Matchups and duos split a champion's games further, so they get a lower bar.
  pairGames: 30,
};

export async function latestPatches(db: D1Database, count = 2): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT patch FROM stat_matches GROUP BY patch ORDER BY MAX(last_start) DESC LIMIT ?")
    .bind(count)
    .all<{ patch: string }>();
  return results.map((r) => r.patch);
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

export type TierEntry = {
  championId: number;
  games: number;
  winRate: number;
  pickRate: number;
  /** Share of games the champion was banned in, any role; ranked only. */
  banRate: number | null;
  score: number;
  tier: string;
  /** Newest patch against the one before, when both have enough games. */
  winRateChange: number | null;
  /** Change in pick rate over the same two patches; null when either has too few games. */
  pickRateChange?: number | null;
};

const smoothed = (wins: number, games: number) => (wins + sampleLimits.priorGames / 2) / (games + sampleLimits.priorGames);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const RANKED = 420;
const ARENA = 1700;

/** Players a pick rate is out of in one match: two per role on the Rift, everyone elsewhere. */
function slotsPerGame(queue: number) {
  return queue === RANKED ? 2 : queue === ARENA ? 16 : 10;
}

// A tier mixes how a champion wins with how much it's played. The win rate,
// pulled towards 50%, carries most of it; presence (pick rate plus the bans
// that fall on this role) moves it by PRESENCE_WEIGHT per doubling against
// the role's average, so a strong pick nobody plays doesn't top the list.
const PRESENCE_WEIGHT = 0.006;
const TIER_CUTS: [number, string][] = [[0.5175, "S"], [0.5085, "A"], [0.4985, "B"], [0.489, "C"]];

type Unranked = Omit<TierEntry, "tier" | "score"> & { wins: number; presence: number };

/**
 * Win rate pulled towards the role's average by `prior` games, shifted so an
 * average role sits at 50%, plus a bonus or malus for how much the champion is
 * present. Few games stay near the middle whatever their win rate.
 */
export function tierScore(wins: number, games: number, roleAverage: number, lift: number, prior = sampleLimits.tierPriorGames) {
  const win = (wins + prior * roleAverage) / (games + prior) + (0.5 - roleAverage);
  return round3(win + PRESENCE_WEIGHT * lift);
}

export type TierRule = { priorGames: number; presenceWeight: number; listGames: number; tierGames: number; cuts: { tier: string; score: number }[] };

/** The numbers behind a tier, so the app explains the rule it is really using. */
export const tierRule = (): TierRule => ({
  priorGames: sampleLimits.tierPriorGames,
  presenceWeight: PRESENCE_WEIGHT,
  listGames: sampleLimits.listGames,
  tierGames: sampleLimits.tierGames,
  cuts: TIER_CUTS.map(([score, tier]) => ({ tier, score })),
});

export const tierOf = (score: number) => TIER_CUTS.find(([cut]) => score >= cut)?.[1] ?? "D";

function assignTiers(entries: Unranked[]): TierEntry[] {
  const reference = entries.reduce((sum, e) => sum + e.presence, 0) / Math.max(entries.length, 1);
  const totalGames = entries.reduce((sum, e) => sum + e.games, 0);
  const roleAverage = totalGames ? entries.reduce((sum, e) => sum + e.wins, 0) / totalGames : 0.5;
  return entries
    .map(({ wins, presence, ...e }) => {
      const lift = Math.max(-3, Math.min(2, Math.log2(Math.max(presence, 1e-4) / reference)));
      const score = tierScore(wins, e.games, roleAverage, lift);
      return { ...e, score, tier: tierOf(score) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Pool matches in ranked and how often each champion was banned in them. */
<<<<<<< HEAD
async function poolBans(db: D1Database, patches: string[], bracket: Where): Promise<{ matches: number; bans: Map<number, number> }> {
=======
async function poolBans(db: D1Database, patches: string[], bracket: Bracket, region?: Region): Promise<{ matches: number; bans: Map<number, number> }> {
>>>>>>> auto/33-rank-api
  // One query per kind: an IN over two kinds makes SQLite skip stat_counts_by_kind and scan every count.
  const byKind = (kind: string) =>
    db
      .prepare(
        `SELECT champion_id, SUM(games) AS games FROM ${scope("stat_counts", bracket)}
          WHERE kind = ? AND queue_id = ${RANKED} AND patch IN (${placeholders(patches.length)}) GROUP BY champion_id`,
      )
      .bind(kind, ...patches)
      .all<{ champion_id: number; games: number }>();
  const [{ results: matches }, { results: bans }] = await Promise.all([byKind(regionKind("pool-games", region)), byKind(regionKind("pool-ban", region))]);
  return { matches: matches[0]?.games ?? 0, bans: new Map(bans.map((r) => [r.champion_id, r.games])) };
}

const banRateOf = (data: { matches: number; bans: Map<number, number> }, championId: number) =>
  data.matches >= sampleLimits.tierGames ? round3((data.bans.get(championId) ?? 0) / data.matches) : null;

/** `position` is "" for queues without roles (ARAM, Arena, URF). */
export async function tierList(
  db: D1Database,
  position: string,
  queue = RANKED,
<<<<<<< HEAD
  bracket: Where = DEFAULT_BRACKET,
=======
  bracket: Bracket = DEFAULT_BRACKET,
  region?: Region,
>>>>>>> auto/33-rank-api
): Promise<{ patches: string[]; games: number; champions: TierEntry[]; rule: TierRule }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, champions: [], rule: tierRule() };
  const { results: byPatch } = await db
    .prepare(
      `SELECT champion_id, patch, games, wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND queue_id = ? AND kind = ?`,
    )
    .bind(...patches, position, queue, regionKind("pool", region))
    .all<{ champion_id: number; patch: string; games: number; wins: number }>();
  const byChampion = new Map<number, { games: number; wins: number; patches: Map<string, { games: number; wins: number }> }>();
  for (const r of byPatch) {
    const c = byChampion.get(r.champion_id) ?? { games: 0, wins: 0, patches: new Map() };
    c.games += r.games;
    c.wins += r.wins;
    c.patches.set(r.patch, r);
    byChampion.set(r.champion_id, c);
  }
  const patchGames = new Map<string, number>();
  for (const r of byPatch) patchGames.set(r.patch, (patchGames.get(r.patch) ?? 0) + r.games);
  const total = [...byChampion.values()].reduce((sum, c) => sum + c.games, 0);
  const matches = total / slotsPerGame(queue);

  // A ban counts against every role the champion plays, so each role gets its share.
  const ranked = queue === RANKED;
  const bans = ranked ? await poolBans(db, patches, bracket, region) : null;
  const allRoles = new Map<number, number>();
  if (ranked) {
    const { results } = await db
      .prepare(
        `SELECT champion_id, SUM(games) AS games FROM ${scope("stat_counts", bracket)}
          WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ${RANKED} AND kind = ? GROUP BY champion_id`,
      )
      .bind(...patches, regionKind("pool", region))
      .all<{ champion_id: number; games: number }>();
    for (const r of results) allRoles.set(r.champion_id, r.games);
  }

  const entries = [...byChampion.entries()]
    .filter(([, c]) => c.games >= Math.min(sampleLimits.listGames, sampleLimits.tierGames))
    .map(([championId, c]) => {
      const pickRate = c.games / matches;
      const banRate = bans ? banRateOf(bans, championId) : null;
      const roleShare = c.games / (allRoles.get(championId) ?? c.games);
      return {
        championId,
        games: c.games,
        wins: c.wins,
        winRate: round3(c.wins / c.games),
        pickRate: round3(pickRate),
        banRate,
        presence: pickRate + (banRate ?? 0) * roleShare,
        winRateChange: patchChange(patches, c.patches),
        pickRateChange: pickChange(patches, c.patches, patchGames, slotsPerGame(queue)),
      };
    });
  return { patches, games: total, champions: assignTiers(entries), rule: tierRule() };
}

function patchChange(patches: string[], byPatch: Map<string, { games: number; wins: number }>): number | null {
  const [newest, previous] = patches.map((p) => byPatch.get(p));
  return newest && previous && newest.games >= sampleLimits.tierGames && previous.games >= sampleLimits.tierGames
    ? round3(newest.wins / newest.games - previous.wins / previous.games)
    : null;
}

function pickChange(patches: string[], byPatch: Map<string, { games: number }>, patchGames: Map<string, number>, slots: number): number | null {
  const [newest, previous] = patches.map((p) => ({ own: byPatch.get(p)?.games ?? 0, all: patchGames.get(p) ?? 0 }));
  if (!newest || !previous || newest.own < sampleLimits.tierGames || previous.own < sampleLimits.tierGames) return null;
  return round3(newest.own / (newest.all / slots) - previous.own / (previous.all / slots));
}

export type ChampionOverview = {
  patches: string[];
  /** Where the champion is played, most games first. */
  positions: { position: string; games: number; share: number }[];
  /** The role the numbers are for: the one asked for, else the most played. */
  position: string | null;
  games: number;
  winRate: number;
  pickRate: number;
  tier: string | null;
  /** Newest patch against the one before, when both have enough games. */
  winRateChange: number | null;
  /** Share of ranked games the champion was banned in; null outside ranked. */
  banRate: number | null;
};

export async function championOverview(
  db: D1Database,
  championId: number,
  position: string | null,
  queue = 420,
  bracket: Where = DEFAULT_BRACKET,
): Promise<ChampionOverview | null> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return null;
  const ranked = queue === 420;
  const { results: byPosition } = await db
    .prepare(
      `SELECT team_position AS position, SUM(games) AS games FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND queue_id = ? AND kind = 'games'
        GROUP BY team_position ORDER BY games DESC`,
    )
    .bind(...patches, championId, queue)
    .all<{ position: string; games: number }>();
  const played = byPosition.reduce((sum, p) => sum + p.games, 0);
  if (played === 0) return null;
  const positions = ranked ? byPosition.filter((p) => p.position).map((p) => ({ ...p, share: round3(p.games / played) })) : [];
  const used = !ranked ? "" : position && positions.some((p) => p.position === position) ? position : positions[0]?.position;
  if (used === undefined) return null;

  const list = await tierList(db, used, queue, bracket);
  const entry = list.champions.find((c) => c.championId === championId);
  // Roles above come from every game, so builds cover KR too; the numbers below are the pool's, like the tier list.
  const { results: byPatch } = await db
    .prepare(
      `SELECT patch, games, wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ? AND queue_id = ? AND kind = 'pool'`,
    )
    .bind(...patches, championId, used, queue)
    .all<{ patch: string; games: number; wins: number }>();
  const games = byPatch.reduce((sum, p) => sum + p.games, 0);
  const wins = byPatch.reduce((sum, p) => sum + p.wins, 0);

  return {
    patches,
    positions,
    position: used || null,
    games,
    winRate: round3(wins / Math.max(games, 1)),
    pickRate: round3(games / Math.max(list.games / slotsPerGame(queue), 1)),
    tier: entry?.tier ?? null,
    winRateChange: patchChange(patches, new Map(byPatch.map((p) => [p.patch, p]))),
    banRate: ranked ? banRateOf(await poolBans(db, patches, bracket), championId) : null,
  };
}

export type Matchup = { championId: number; games: number; winRate: number };

/** The champion's win rate against each lane opponent; hardest first. */
export async function counters(
  db: D1Database,
  championId: number,
  position: string,
  bracket: Bracket = DEFAULT_BRACKET,
): Promise<{ patches: string[]; games: number; matchups: Matchup[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, matchups: [] };
  const { results } = await db
    .prepare(
      `SELECT CAST(value AS INTEGER) AS opponent, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND champion_id = ? AND team_position = ?
          AND kind = 'opponent'
        GROUP BY value`,
    )
    .bind(...patches, championId, position)
    .all<{ opponent: number; games: number; wins: number }>();
  const matchups = results
    .filter((r) => r.games >= sampleLimits.pairGames)
    .map((r) => ({ championId: r.opponent, games: r.games, winRate: round3(r.wins / r.games), score: smoothed(r.wins, r.games) }))
    .sort((a, b) => a.score - b.score)
    .map(({ score: _, ...m }) => m);
  return { patches, games: results.reduce((sum, r) => sum + r.games, 0), matchups };
}

export type BanSuggestion ={ championId: number; games: number; winRate: number; banScore: number };

/** Champions that win often and show up often: banning them removes the most wins. */
export async function banSuggestions(db: D1Database, limit = 5): Promise<{ patches: string[]; champions: BanSuggestion[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, champions: [] };
  const { results } = await db
    .prepare(
      `SELECT champion_id, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND kind = 'pool' GROUP BY champion_id`,
    )
    .bind(...patches)
    .all<{ champion_id: number; games: number; wins: number }>();
  // Each game has ten participants, so this is the share of games a champion appears in.
  const matches = results.reduce((sum, r) => sum + r.games, 0) / 10;
  const champions = results
    .filter((r) => r.games >= sampleLimits.tierGames)
    .map((r) => ({
      championId: r.champion_id,
      games: r.games,
      winRate: round3(r.wins / r.games),
      banScore: round3((smoothed(r.wins, r.games) - 0.5) * (r.games / matches)),
    }))
    .filter((c) => c.banScore > 0)
    .sort((a, b) => b.banScore - a.banScore)
    .slice(0, limit);
  return { patches, champions };
}

/** How the champion does with each ranked teammate; best first. */
export async function synergies(
  db: D1Database,
  championId: number,
  position: string,
  bracket: Bracket = DEFAULT_BRACKET,
): Promise<{ patches: string[]; games: number; allies: (Matchup & { position: string })[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, allies: [] };
  const { results } = await db
    .prepare(
      `SELECT value, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND champion_id = ? AND team_position = ?
          AND kind = 'ally'
        GROUP BY value`,
    )
    .bind(...patches, championId, position)
    .all<{ value: string; games: number; wins: number }>();
  const allies = results
    .filter((r) => r.games >= sampleLimits.pairGames)
    .map((r) => {
      const [ally, allyPosition] = r.value.split(":");
      return { championId: Number(ally), position: allyPosition, games: r.games, winRate: round3(r.wins / r.games), score: smoothed(r.wins, r.games) };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ score: _, ...a }) => a);
  return { patches, games: results.reduce((sum, r) => sum + r.games, 0), allies };
}

export type AugmentStat = {
  augmentId: number;
  games: number;
  pickRate: number;
  winRate: number;
  tier: string;
  /** Win rate minus the champion's (or the mode's) own rate with any augment. */
  delta: number;
};

type AugmentRow = { kind: string; value: string; games: number; wins: number };

/**
 * Pulls a win rate towards a baseline rather than 50%, then reads it as a lift
 * over that baseline, so a strong champion's augments aren't all S just
 * because the champion wins a lot.
 */
const liftScore = (wins: number, games: number, baseline: number) =>
  (wins + sampleLimits.priorGames * baseline) / (games + sampleLimits.priorGames) - baseline + 0.5;

function rateAugments(rows: AugmentRow[]): { games: number; augments: AugmentStat[] } {
  const all = rows.find((r) => r.kind === "augmented");
  const games = all?.games ?? 0;
  const baseline = all && all.games > 0 ? all.wins / all.games : 0.5;
  const augments = rows
    .filter((r) => r.kind === "augment" && r.games >= sampleLimits.pairGames)
    .map((r) => ({
      augmentId: Number(r.value),
      games: r.games,
      pickRate: round3(r.games / Math.max(games, 1)),
      winRate: round3(r.wins / r.games),
      delta: round3(r.wins / r.games - baseline),
      score: liftScore(r.wins, r.games, baseline),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...a }) => ({ ...a, tier: tierOf(score) }));
  return { games, augments };
}

/**
 * Arena and ARAM Mayhem augments, overall or for one champion: how often each
 * is taken and how it does (in Arena a "win" is a top-four finish), tiered
 * by the lift over the champion's own rate. The Worker serves these only
 * while AUGMENTS is "on".
 */
export async function augmentStats(
  db: D1Database,
  queue: number,
  championId: number | null,
): Promise<{ patches: string[]; games: number; augments: AugmentStat[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, augments: [] };
  const { results } = await db
    .prepare(
      `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? ${championId ? "AND champion_id = ?" : ""}
          AND kind IN ('augment', 'augmented')
        GROUP BY kind, value`,
    )
    .bind(...patches, queue, ...(championId ? [championId] : []))
    .all<AugmentRow>();
  return { patches, ...rateAugments(results) };
}

export type AugmentChampion = { championId: number; games: number; winRate: number; delta: number; tier: string };
export type AugmentChampions = { augmentId: number; champions: AugmentChampion[] };

const AUGMENT_CHAMPIONS_SHOWN = 10;

/**
 * For every augment, the champions it lifts most over their own rate. One
 * document per queue keeps the D1 writes down.
 */
export async function augmentChampions(db: D1Database, queue: number): Promise<{ patches: string[]; augments: AugmentChampions[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, augments: [] };
  const { results } = await db
    .prepare(
      `SELECT champion_id, kind, value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? AND kind IN ('augment', 'augmented')
        GROUP BY champion_id, kind, value`,
    )
    .bind(...patches, queue)
    .all<AugmentRow & { champion_id: number }>();
  const byChampion = new Map<number, AugmentRow[]>();
  for (const r of results) {
    const list = byChampion.get(r.champion_id) ?? [];
    list.push(r);
    byChampion.set(r.champion_id, list);
  }
  const byAugment = new Map<number, (AugmentChampion & { score: number })[]>();
  for (const [championId, rows] of byChampion) {
    const all = rows.find((r) => r.kind === "augmented");
    const baseline = all && all.games > 0 ? all.wins / all.games : 0.5;
    for (const r of rows) {
      if (r.kind !== "augment" || r.games < sampleLimits.pairGames) continue;
      const score = liftScore(r.wins, r.games, baseline);
      const list = byAugment.get(Number(r.value)) ?? [];
      list.push({ championId, games: r.games, winRate: round3(r.wins / r.games), delta: round3(r.wins / r.games - baseline), tier: tierOf(score), score });
      byAugment.set(Number(r.value), list);
    }
  }
  const augments = [...byAugment]
    .map(([augmentId, list]) => ({
      augmentId,
      champions: list
        .sort((a, b) => b.score - a.score)
        .slice(0, AUGMENT_CHAMPIONS_SHOWN)
        .map(({ score: _, ...c }) => c),
    }))
    .sort((a, b) => a.augmentId - b.augmentId);
  return { patches, augments };
}

export type DuoPartner = { championId: number; games: number; winRate: number };

/** Arena partners for a champion: how often a top-four finish follows each pairing. */
export async function arenaDuos(db: D1Database, championId: number): Promise<{ patches: string[]; games: number; partners: DuoPartner[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, partners: [] };
  const { results } = await db
    .prepare(
      `SELECT value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? AND champion_id = ? AND kind = 'duo'
        GROUP BY value`,
    )
    .bind(...patches, ARENA, championId)
    .all<{ value: string; games: number; wins: number }>();
  const partners = results
    .filter((r) => r.games >= sampleLimits.pairGames)
    .map((r) => ({ championId: Number(r.value), games: r.games, winRate: round3(r.wins / r.games), score: smoothed(r.wins, r.games) }))
    .sort((a, b) => b.score - a.score)
    .map(({ score: _, ...p }) => p);
  return { patches, games: results.reduce((sum, r) => sum + r.games, 0), partners };
}

export type ArenaItem = { id: number; games: number; pickRate: number; winRate: number };

const ARENA_ITEMS_SHOWN = 24;

/** Items bought in Arena games with a champion; a "win" is a top-four finish. The client keeps finished items. */
export async function arenaItems(db: D1Database, championId: number): Promise<{ patches: string[]; games: number; items: ArenaItem[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, items: [] };
  const { results } = await db
    .prepare(
      `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? AND champion_id = ? AND kind IN ('item', 'games')
        GROUP BY kind, value`,
    )
    .bind(...patches, ARENA, championId)
    .all<{ kind: string; value: string; games: number; wins: number }>();
  const games = results.find((r) => r.kind === "games")?.games ?? 0;
  const items = results
    .filter((r) => r.kind === "item" && r.games >= sampleLimits.pairGames)
    .map((r) => ({ id: Number(r.value), games: r.games, pickRate: round3(r.games / Math.max(games, 1)), winRate: round3(r.wins / r.games), score: smoothed(r.wins, r.games) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, ARENA_ITEMS_SHOWN)
    .map(({ score: _, ...i }) => i);
  return { patches, games, items };
}

export type LaneStat = {
  games: number;
  /** Averages from the champion's side: positive means ahead of the opponent. */
  csDiff10: number;
  csDiff15: number;
  goldDiff10: number;
  goldDiff15: number;
  firstBloodRate: number;
};

// Timelines are fetched for few games, so lane numbers come from small samples; the count is always shown.
const MIN_LANE_GAMES = 10;

/** Lane differences against each opponent with enough timeline games, keyed by opponent id. */
export async function laneStats(db: D1Database, championId: number, position: string, bracket: Bracket = DEFAULT_BRACKET): Promise<Record<number, LaneStat>> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return {};
  const { results } = await db
    .prepare(
      `SELECT opponent_id, SUM(games) AS games, SUM(cs10) AS cs10, SUM(cs15) AS cs15, SUM(gold10) AS gold10,
          SUM(gold15) AS gold15, SUM(first_bloods) AS first_bloods
        FROM ${scope("lane_sums", bracket)} WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ?
        GROUP BY opponent_id HAVING SUM(games) >= ?`,
    )
    .bind(...patches, championId, position, MIN_LANE_GAMES)
    .all<{ opponent_id: number; games: number; cs10: number; cs15: number; gold10: number; gold15: number; first_bloods: number }>();
  const avg = (sum: number, games: number) => Math.round((sum / games) * 10) / 10;
  return Object.fromEntries(
    results.map((r) => [
      r.opponent_id,
      {
        games: r.games,
        csDiff10: avg(r.cs10, r.games),
        csDiff15: avg(r.cs15, r.games),
        goldDiff10: Math.round(r.gold10 / r.games),
        goldDiff15: Math.round(r.gold15 / r.games),
        firstBloodRate: round3(r.first_bloods / r.games),
      },
    ]),
  );
}

// Timelines are fetched for few games, so each minute carries its game count.
const MIN_BENCH_GAMES = 20;

/** The KDA fields appear only for minutes with enough games that carried them. */
export type BenchMinute = {
  minute: number;
  games: number;
  cs: number;
  level: number;
  kdaGames?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  /** Share of the team's kills the player took part in, 0 to 1. */
  killParticipation?: number;
};

/** Average CS and level at the sample minutes for ranked games of this champion and role. */
export async function benchStats(db: D1Database, championId: number, position: string, bracket: Bracket = DEFAULT_BRACKET): Promise<{ minutes: BenchMinute[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { minutes: [] };
  const { results } = await db
    .prepare(
      `SELECT minute, SUM(games) AS games, SUM(cs) AS cs, SUM(level) AS level,
          SUM(kda_games) AS kda_games, SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists, SUM(team_kills) AS team_kills FROM ${scope("bench_sums", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ?
        GROUP BY minute HAVING SUM(games) >= ? ORDER BY minute`,
    )
    .bind(...patches, championId, position, MIN_BENCH_GAMES)
    .all<{ minute: number; games: number; cs: number; level: number; kda_games: number; kills: number; deaths: number; assists: number; team_kills: number }>();
  const avg = (sum: number, games: number) => Math.round((sum / games) * 10) / 10;
  return {
    minutes: results.map((r) => {
      const minute: BenchMinute = { minute: r.minute, games: r.games, cs: avg(r.cs, r.games), level: avg(r.level, r.games) };
      if (r.kda_games >= MIN_BENCH_GAMES && r.team_kills > 0) {
        minute.kdaGames = r.kda_games;
        minute.kills = avg(r.kills, r.kda_games);
        minute.deaths = avg(r.deaths, r.kda_games);
        minute.assists = avg(r.assists, r.kda_games);
        // Kills and assists over the team's kills, summed over all games so a quiet game doesn't swing it.
        minute.killParticipation = Math.round(((r.kills + r.assists) / r.team_kills) * 1000) / 1000;
      }
      return minute;
    }),
  };
}

// Timelines are fetched for few games, so each item time comes with its game count.
const MIN_ITEM_TIME_GAMES = 10;

/** Average minute each finished item is completed, keyed by item id, for items with enough timeline games. */
export async function itemTimes(db: D1Database, championId: number, position: string): Promise<Record<number, { games: number; minute: number }>> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return {};
  const { results } = await db
    .prepare(
      `SELECT item_id, SUM(games) AS games, SUM(seconds) AS seconds FROM item_time_sums
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ?
        GROUP BY item_id HAVING SUM(games) >= ?`,
    )
    .bind(...patches, championId, position, MIN_ITEM_TIME_GAMES)
    .all<{ item_id: number; games: number; seconds: number }>();
  return Object.fromEntries(results.map((r) => [r.item_id, { games: r.games, minute: Math.round((r.seconds / r.games / 60) * 10) / 10 }]));
}

<<<<<<< HEAD
export type RankCurve = {
  patches: string[];
  /** The order of every entry's points. */
  brackets: Bracket[];
  /** Per champion and role: games, win rate and pick rate in each bracket, null where the bracket has none. */
  entries: { championId: number; position: string; points: ([games: number, winRate: number, pickRate: number] | null)[] }[];
};

/** Every ranked champion and role side by side across the six brackets, from the same pool the tier list reads. */
export async function rankCurve(db: D1Database, brackets: readonly Bracket[], positions: readonly string[]): Promise<RankCurve> {
  const byKey = new Map<string, RankCurve["entries"][number]>();
  let patches: string[] = [];
  for (const [index, bracket] of brackets.entries()) {
    for (const position of positions) {
      const list = await tierList(db, position, RANKED, bracket);
      if (patches.length === 0) patches = list.patches;
      for (const c of list.champions) {
        const key = `${c.championId}:${position}`;
        const entry = byKey.get(key) ?? { championId: c.championId, position, points: brackets.map(() => null) };
        entry.points[index] = [c.games, c.winRate, c.pickRate];
        byKey.set(key, entry);
      }
    }
  }
  return { patches, brackets: [...brackets], entries: [...byKey.values()].sort((a, b) => a.championId - b.championId || a.position.localeCompare(b.position)) };
=======
export type RankCurveRow = {
  championId: number;
  position: string;
  /** Per bracket with games: [games, win rate, pick rate]. Brackets without games are left out. */
  b: Partial<Record<Bracket, [number, number, number]>>;
};

/**
 * Every ranked champion and role in every bracket side by side, for the elo
 * views. Same pool as the tier list (TR and EUW); thin cells are kept with
 * their game counts and the app decides how to show them.
 */
export async function rankCurve(db: D1Database, queue = RANKED): Promise<{ patches: string[]; brackets: Bracket[]; champions: RankCurveRow[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, brackets: [...BRACKETS], champions: [] };
  const { results } = await db
    .prepare(
      `SELECT rank_group, team_position, champion_id, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts_g
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? AND kind = 'pool' GROUP BY rank_group, team_position, champion_id`,
    )
    .bind(...patches, queue)
    .all<{ rank_group: TierGroup; team_position: string; champion_id: number; games: number; wins: number }>();
  const { results: matchRows } = await db
    .prepare(`SELECT rank_group, SUM(games) AS games FROM stat_counts_g WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? AND kind = 'pool-games' GROUP BY rank_group`)
    .bind(...patches, queue)
    .all<{ rank_group: TierGroup; games: number }>();
  const matchesOf = new Map(matchRows.map((r) => [r.rank_group, r.games]));

  const rows = new Map<string, RankCurveRow>();
  for (const r of results) {
    if (!r.team_position) continue;
    const key = `${r.champion_id}:${r.team_position}`;
    const row = rows.get(key) ?? { championId: r.champion_id, position: r.team_position, b: {} };
    rows.set(key, row);
    for (const bracket of BRACKETS) {
      if (!groupsOf(bracket).includes(r.rank_group)) continue;
      const cell = row.b[bracket] ?? [0, 0, 0];
      cell[0] += r.games;
      cell[1] += r.wins;
      row.b[bracket] = cell;
    }
  }
  const bracketMatches = (bracket: Bracket) => groupsOf(bracket).reduce((sum, g) => sum + (matchesOf.get(g) ?? 0), 0);
  for (const row of rows.values()) {
    for (const bracket of BRACKETS) {
      const cell = row.b[bracket];
      if (!cell) continue;
      const matches = bracketMatches(bracket);
      row.b[bracket] = [cell[0], round3(cell[1] / cell[0]), matches > 0 ? round3(cell[0] / matches) : 0];
    }
  }
  const champions = [...rows.values()].sort((a, b) => a.championId - b.championId || a.position.localeCompare(b.position));
  return { patches, brackets: [...BRACKETS], champions };
>>>>>>> auto/33-rank-api
}
