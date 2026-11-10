// Aggregates over the crawler's rolled-up counts in stat_counts: tier lists,
// champion pages, matchups, synergies and bans, over the two newest stored
// patches. Tier lists, pick and ban rates read only the TR and EUW Emerald+
// pool (kinds "pool", "pool-ban", "pool-games"); builds and matchups use
// every crawled game.

import { DEFAULT_BRACKET, type Bracket } from "@vizier/shared/brackets";
import { scope, type Where } from "./localSchema.ts";

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
  /** Games and win rate on each of the two newest patches (newest first), so a thin new patch can show the previous one. */
  byPatch?: PatchSample[];
  /** ARAM only: win rate in short and in long games, when both have enough games. */
  lengthSides?: LengthSides;
};

export type PatchSample = { patch: string; games: number; winRate: number };

const patchSamples = (patches: string[], byPatch: Map<string, { games: number; wins: number }>): PatchSample[] | undefined =>
  patches.length < 2
    ? undefined
    : patches.map((patch) => {
        const p = byPatch.get(patch);
        return { patch, games: p?.games ?? 0, winRate: p && p.games > 0 ? round3(p.wins / p.games) : 0 };
      });

const smoothed = (wins: number, games: number) => (wins + sampleLimits.priorGames / 2) / (games + sampleLimits.priorGames);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const RANKED = 420;
const ARENA = 1700;
const MAYHEM = 2400;
const ARAM = 450;
// A side of the length comparison needs a sample of its own before the tier list says anything about it.
const MIN_LENGTH_SIDE_GAMES = 60;

export type LengthSides = { short: { games: number; winRate: number }; long: { games: number; winRate: number } };

/** Games under 25 minutes against 30 or more (buckets 0-1 and 3-4); null while either side is thin. */
export function lengthSides(buckets: { bucket: number; games: number; wins: number }[]): LengthSides | null {
  const side = (wanted: number[]) => {
    const rows = buckets.filter((b) => wanted.includes(b.bucket));
    const games = rows.reduce((sum, r) => sum + r.games, 0);
    const wins = rows.reduce((sum, r) => sum + r.wins, 0);
    return { games, winRate: games > 0 ? round3(wins / games) : 0 };
  };
  const short = side([0, 1]);
  const long = side([3, 4]);
  return short.games >= MIN_LENGTH_SIDE_GAMES && long.games >= MIN_LENGTH_SIDE_GAMES ? { short, long } : null;
}

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
async function poolBans(db: D1Database, patches: string[], bracket: Where): Promise<{ matches: number; bans: Map<number, number> }> {
  // One query per kind: an IN over two kinds makes SQLite skip stat_counts_by_kind and scan every count.
  const byKind = (kind: string) =>
    db
      .prepare(
        `SELECT champion_id, SUM(games) AS games FROM ${scope("stat_counts", bracket)}
          WHERE kind = ? AND queue_id = ${RANKED} AND patch IN (${placeholders(patches.length)}) GROUP BY champion_id`,
      )
      .bind(kind, ...patches)
      .all<{ champion_id: number; games: number }>();
  const [{ results: matches }, { results: bans }] = await Promise.all([byKind("pool-games"), byKind("pool-ban")]);
  return { matches: matches[0]?.games ?? 0, bans: new Map(bans.map((r) => [r.champion_id, r.games])) };
}

const banRateOf = (data: { matches: number; bans: Map<number, number> }, championId: number) =>
  data.matches >= sampleLimits.tierGames ? round3((data.bans.get(championId) ?? 0) / data.matches) : null;

/** `position` is "" for queues without roles (ARAM, Arena, URF). */
export async function tierList(
  db: D1Database,
  position: string,
  queue = RANKED,
  bracket: Where = DEFAULT_BRACKET,
): Promise<{ patches: string[]; games: number; champions: TierEntry[]; rule: TierRule }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, champions: [], rule: tierRule() };
  const { results: byPatch } = await db
    .prepare(
      `SELECT champion_id, patch, games, wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND queue_id = ? AND kind = 'pool'`,
    )
    .bind(...patches, position, queue)
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
  const bans = ranked ? await poolBans(db, patches, bracket) : null;
  const allRoles = new Map<number, number>();
  if (ranked) {
    const { results } = await db
      .prepare(
        `SELECT champion_id, SUM(games) AS games FROM ${scope("stat_counts", bracket)}
          WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ${RANKED} AND kind = 'pool' GROUP BY champion_id`,
      )
      .bind(...patches)
      .all<{ champion_id: number; games: number }>();
    for (const r of results) allRoles.set(r.champion_id, r.games);
  }

  const sides = new Map<number, LengthSides>();
  if (queue === ARAM) {
    const { results } = await db
      .prepare(
        `SELECT champion_id, CAST(value AS INTEGER) AS bucket, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
          WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND queue_id = ${ARAM} AND kind = 'length' GROUP BY champion_id, value`,
      )
      .bind(...patches, position)
      .all<{ champion_id: number; bucket: number; games: number; wins: number }>();
    const rowsOf = new Map<number, { bucket: number; games: number; wins: number }[]>();
    for (const r of results) rowsOf.set(r.champion_id, [...(rowsOf.get(r.champion_id) ?? []), r]);
    for (const [id, rows] of rowsOf) {
      const split = lengthSides(rows);
      if (split) sides.set(id, split);
    }
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
        byPatch: patchSamples(patches, c.patches),
        ...(sides.has(championId) ? { lengthSides: sides.get(championId) } : {}),
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
  /**
   * Games and win rate by game length, in buckets 0 to 4 (under 20, 20 to 25, 25 to 30, 30 to 35, 35+ minutes).
   * Only buckets with games are listed; ranked and ARAM only; missing in region views and for docs older than it.
   */
  lengths?: { bucket: number; games: number; winRate: number }[];
  /** Jungle only: how the first minutes went. Missing for other roles and before timelines were read for it. */
  jungle?: JungleRoutes;
  /** How often the champion's team took each first objective, against the role's average. Missing before games carried it. */
  objectives?: ObjectiveRates;
  /** Games and win rate on each of the two newest patches (newest first); missing with one patch. */
  byPatch?: PatchSample[];
};

export type ObjectiveRates = {
  /** Games that carried objective data. */
  games: number;
  /** `key` is d dragon, g grubs, h herald, t tower, c first blood; `games` is where the team took it first. */
  rates: { key: string; games: number; rate: number; winRate: number; roleRate: number }[];
};

const MIN_OBJECTIVE_GAMES = 30;
const OBJECTIVES = ["d", "g", "h", "t", "c"];

async function objectiveRates(db: D1Database, patches: string[], championId: number, position: string, bracket: Where): Promise<ObjectiveRates | null> {
  const read = async (champion: boolean) => {
    const { results } = await db
      .prepare(
        `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
          WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND queue_id = ${RANKED} AND kind IN ('obj', 'obj-games')
            ${champion ? "AND champion_id = ?" : ""}
          GROUP BY kind, value`,
      )
      .bind(...patches, position, ...(champion ? [championId] : []))
      .all<{ kind: string; value: string; games: number; wins: number }>();
    return { total: results.find((r) => r.kind === "obj-games")?.games ?? 0, by: new Map(results.filter((r) => r.kind === "obj").map((r) => [r.value, r])) };
  };
  const own = await read(true);
  if (own.total < MIN_OBJECTIVE_GAMES) return null;
  const role = await read(false);
  return {
    games: own.total,
    rates: OBJECTIVES.flatMap((key) => {
      const mine = own.by.get(key);
      const all = role.by.get(key);
      if (!all || role.total === 0) return [];
      return [{ key, games: mine?.games ?? 0, rate: round3((mine?.games ?? 0) / own.total), winRate: mine ? round3(mine.wins / mine.games) : 0, roleRate: round3(all.games / role.total) }];
    }),
  };
}

export type JungleRoutes = {
  /** Games with a route; the share of every path is out of these. */
  games: number;
  /** First camps' side and the first lane visited, most played first. */
  paths: { side: "top" | "bot"; lane: "top" | "mid" | "bot" | "none"; games: number; winRate: number }[];
  /** Median minute of the first gank among games that had one, with how many did. */
  gank: { games: number; medianMinute: number } | null;
};

const MIN_ROUTE_GAMES = 20;
const MAX_ROUTES = 6;

async function jungleRoutes(db: D1Database, patches: string[], championId: number, bracket: Where): Promise<JungleRoutes | null> {
  const { results } = await db
    .prepare(
      `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = 'JUNGLE' AND queue_id = ${RANKED} AND kind IN ('jpath', 'jgank')
        GROUP BY kind, value`,
    )
    .bind(...patches, championId)
    .all<{ kind: string; value: string; games: number; wins: number }>();
  const paths = results
    .filter((r) => r.kind === "jpath")
    .sort((a, b) => b.games - a.games || a.value.localeCompare(b.value));
  const games = paths.reduce((sum, r) => sum + r.games, 0);
  if (games < MIN_ROUTE_GAMES) return null;
  const ganks = results.filter((r) => r.kind === "jgank" && r.value !== "none").map((r) => ({ minute: Number(r.value), games: r.games })).sort((a, b) => a.minute - b.minute);
  const ganked = ganks.reduce((sum, g) => sum + g.games, 0);
  let seen = 0;
  const median = ganks.find((g) => (seen += g.games) >= ganked / 2)?.minute;
  return {
    games,
    paths: paths.slice(0, MAX_ROUTES).map((r) => {
      const [side, lane] = r.value.split("|");
      return { side: side as "top" | "bot", lane: lane as "top" | "mid" | "bot" | "none", games: r.games, winRate: round3(r.wins / r.games) };
    }),
    gank: ganked >= MIN_ROUTE_GAMES && median !== undefined ? { games: ganked, medianMinute: median } : null,
  };
}

async function lengthRows(db: D1Database, patches: string[], championId: number, position: string, bracket: Where, queue = RANKED) {
  const { results } = await db
    .prepare(
      `SELECT CAST(value AS INTEGER) AS bucket, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ? AND queue_id = ${queue} AND kind = 'length'
        GROUP BY value ORDER BY bucket`,
    )
    .bind(...patches, championId, position)
    .all<{ bucket: number; games: number; wins: number }>();
  return results.map((r) => ({ bucket: r.bucket, games: r.games, winRate: round3(r.wins / r.games) }));
}

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

  const samples = patchSamples(patches, new Map(byPatch.map((p) => [p.patch, p])));
  const lengths = ranked ? await lengthRows(db, patches, championId, used, bracket) : queue === ARAM ? await lengthRows(db, patches, championId, "", bracket, ARAM) : [];
  const objectives = ranked && used ? await objectiveRates(db, patches, championId, used, bracket) : null;
  const jungle = ranked && used === "JUNGLE" ? await jungleRoutes(db, patches, championId, bracket) : null;
  return {
    patches,
    positions,
    position: used || null,
    games,
    winRate: round3(wins / Math.max(games, 1)),
    pickRate: round3(games / Math.max(list.games / slotsPerGame(queue), 1)),
    tier: entry?.tier ?? null,
    winRateChange: patchChange(patches, new Map(byPatch.map((p) => [p.patch, p]))),
    ...(samples ? { byPatch: samples } : {}),
    banRate: ranked ? banRateOf(await poolBans(db, patches, bracket), championId) : null,
    ...(lengths.length > 0 ? { lengths } : {}),
    ...(jungle ? { jungle } : {}),
    ...(objectives && objectives.rates.length > 0 ? { objectives } : {}),
  };
}

export type Matchup = {
  championId: number;
  games: number;
  winRate: number;
  /** The matchup's games and win rate in each game length bucket (see ChampionOverview.lengths); missing for docs from before. */
  lengths?: { bucket: number; games: number; winRate: number }[];
};

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
  const { results: byLength } = await db
    .prepare(
      `SELECT value, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND champion_id = ? AND team_position = ? AND kind = 'vs-length'
        GROUP BY value`,
    )
    .bind(...patches, championId, position)
    .all<{ value: string; games: number; wins: number }>();
  const lengthsOf = new Map<number, { bucket: number; games: number; winRate: number }[]>();
  for (const r of byLength) {
    const [opponent, bucket] = r.value.split("|").map(Number);
    lengthsOf.set(opponent, [...(lengthsOf.get(opponent) ?? []), { bucket, games: r.games, winRate: round3(r.wins / r.games) }]);
  }
  const matchups = results
    .filter((r) => r.games >= sampleLimits.pairGames)
    .map((r) => {
      const lengths = lengthsOf.get(r.opponent)?.sort((a, b) => a.bucket - b.bucket);
      return { championId: r.opponent, games: r.games, winRate: round3(r.wins / r.games), ...(lengths ? { lengths } : {}), score: smoothed(r.wins, r.games) };
    })
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

export type AugmentPair = { augmentIds: [number, number]; games: number; winRate: number; delta: number };

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
): Promise<{ patches: string[]; games: number; augments: AugmentStat[]; pairs?: AugmentPair[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, augments: [] };
  const pairs = championId !== null && queue === MAYHEM;
  const { results } = await db
    .prepare(
      `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? ${championId ? "AND champion_id = ?" : ""}
          AND kind IN ('augment', 'augmented'${pairs ? ", 'augpair'" : ""})
        GROUP BY kind, value`,
    )
    .bind(...patches, queue, ...(championId ? [championId] : []))
    .all<AugmentRow>();
  const rated = rateAugments(results.filter((r) => r.kind !== "augpair"));
  const best = pairs ? bestPairs(results.filter((r) => r.kind === "augpair"), results) : [];
  return { patches, ...rated, ...(best.length > 0 ? { pairs: best } : {}) };
}

const PAIRS_SHOWN = 5;

/** The pairs that lift the champion most over its own rate, only from pairs with enough games. */
function bestPairs(rows: AugmentRow[], all: AugmentRow[]): AugmentPair[] {
  const total = all.find((r) => r.kind === "augmented");
  const baseline = total && total.games > 0 ? total.wins / total.games : 0.5;
  return rows
    .filter((r) => r.games >= sampleLimits.pairGames)
    .map((r) => {
      const [a, b] = r.value.split("|").map(Number);
      return { augmentIds: [a, b] as [number, number], games: r.games, winRate: round3(r.wins / r.games), delta: round3(r.wins / r.games - baseline), score: liftScore(r.wins, r.games, baseline) };
    })
    .sort((a, b) => b.score - a.score || b.games - a.games)
    .slice(0, PAIRS_SHOWN)
    .map(({ score: _, ...p }) => p);
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
}

/** One champion's per-game averages in a role: each figure carries the games it comes from. */
export type BoardRow = {
  championId: number;
  /** Games that carried kills, deaths, assists, farm and length; fewer than the tier list's games while older games lack them. */
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  /** (kills + assists) / deaths, with deaths at least 1. */
  kda: number;
  csPerMinute: number;
  minutes: number;
  /** Gold lead over the lane opponent at 15 minutes, from games with a timeline; null when there are too few. */
  goldDiff15: { games: number; value: number } | null;
  /** Win rate in games of 35 minutes or more; null with fewer than 20 of them. */
  late: { games: number; winRate: number } | null;
};

const MIN_BOARD_GAMES = 20;
const MIN_LATE_GAMES = 20;

/**
 * Averages for the stats explorer, one row per champion in a role. The win,
 * pick and ban columns come from the tier list; these are the figures it does
 * not carry.
 */
export async function statsBoard(db: D1Database, position: string, bracket: Bracket = DEFAULT_BRACKET): Promise<{ patches: string[]; rows: BoardRow[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, rows: [] };
  const table = scope("stat_counts", bracket);
  const { results } = await db
    .prepare(
      `SELECT champion_id, kind, SUM(games) AS games FROM ${table}
        WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND queue_id = ${RANKED}
          AND kind IN ('stat-n', 'sum-kills', 'sum-deaths', 'sum-assists', 'sum-cspm', 'sum-secs')
        GROUP BY champion_id, kind`,
    )
    .bind(...patches, position)
    .all<{ champion_id: number; kind: string; games: number }>();
  const lane = await db
    .prepare(
      `SELECT champion_id, SUM(games) AS games, SUM(gold15) AS gold15 FROM ${scope("lane_sums", bracket)}
        WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? GROUP BY champion_id`,
    )
    .bind(...patches, position)
    .all<{ champion_id: number; games: number; gold15: number }>();
  const laneBy = new Map(lane.results.map((r) => [r.champion_id, r]));
  const { results: lateRows } = await db
    .prepare(
      `SELECT champion_id, SUM(games) AS games, SUM(wins) AS wins FROM ${table}
        WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND queue_id = ${RANKED} AND kind = 'length' AND value = '4'
        GROUP BY champion_id`,
    )
    .bind(...patches, position)
    .all<{ champion_id: number; games: number; wins: number }>();
  const lateBy = new Map(lateRows.map((r) => [r.champion_id, r]));
  const by = new Map<number, Map<string, number>>();
  for (const r of results) by.set(r.champion_id, (by.get(r.champion_id) ?? new Map()).set(r.kind, r.games));
  const rows: BoardRow[] = [];
  for (const [championId, k] of by) {
    const n = k.get("stat-n") ?? 0;
    if (n < MIN_BOARD_GAMES) continue;
    const avg = (kind: string, scale = 1) => ((k.get(kind) ?? 0) / n) / scale;
    const kills = avg("sum-kills");
    const deaths = avg("sum-deaths");
    const assists = avg("sum-assists");
    const l = laneBy.get(championId);
    const late = lateBy.get(championId);
    rows.push({
      championId,
      games: n,
      kills: Math.round(kills * 10) / 10,
      deaths: Math.round(deaths * 10) / 10,
      assists: Math.round(assists * 10) / 10,
      kda: Math.round(((kills + assists) / Math.max(deaths, 1)) * 100) / 100,
      csPerMinute: Math.round(avg("sum-cspm", 100) * 10) / 10,
      minutes: Math.round(avg("sum-secs", 60) * 10) / 10,
      goldDiff15: l && l.games >= MIN_LANE_GAMES ? { games: l.games, value: Math.round(l.gold15 / l.games) } : null,
      late: late && late.games >= MIN_LATE_GAMES ? { games: late.games, winRate: round3(late.wins / late.games) } : null,
    });
  }
  return { patches, rows: rows.sort((a, b) => b.games - a.games || a.championId - b.championId) };
}
