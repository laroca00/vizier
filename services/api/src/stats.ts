// Aggregates over the crawler's games: benchmarks, tier lists, bans. Tiers,
// matchups and bans read the rolled-up counts in stat_counts; benchmarks and
// pace need every value, so they read the last few days of raw rows.
// Everything covers the two newest stored patches.

export const METRICS = ["cs10", "cs_pm", "gold_pm", "vision_pm", "kill_participation", "damage_share", "deaths"] as const;
export type Metric = (typeof METRICS)[number];

/** 21 values: the 0th, 5th, ..., 100th percentile. */
export type Distribution = { games: number; quantiles: number[] };
export type Benchmarks = { position: string; championId: number | null; patches: string[]; metrics: Partial<Record<Metric, Distribution>> };

// Below this many games a champion-specific benchmark is noise; the role's is used instead.
const MIN_CHAMPION_GAMES = 50;
// Shrinks small samples towards 50% so a 3-0 champion doesn't top the list.
const PRIOR_GAMES = 50;
const MIN_TIER_GAMES = 10;

export async function latestPatches(db: D1Database, count = 2): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT patch FROM stat_matches GROUP BY patch ORDER BY MAX(last_start) DESC LIMIT ?")
    .bind(count)
    .all<{ patch: string }>();
  return results.map((r) => r.patch);
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

export function quantiles(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: 21 }, (_, i) => {
    const at = (i / 20) * (sorted.length - 1);
    const lo = Math.floor(at);
    const hi = Math.ceil(at);
    return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)) * 100) / 100;
  });
}

/** Share of benchmark games below `value`, from the quantile table. */
export function rankOf(distribution: Distribution, value: number): number {
  const q = distribution.quantiles;
  if (value <= q[0]) return 0;
  if (value >= q[20]) return 1;
  for (let i = 1; i <= 20; i++) {
    if (value <= q[i]) {
      const span = q[i] - q[i - 1];
      const within = span > 0 ? (value - q[i - 1]) / span : 0;
      return (i - 1 + within) / 20;
    }
  }
  return 1;
}

export async function benchmarks(db: D1Database, position: string, championId: number | null = null): Promise<Benchmarks> {
  const patches = await latestPatches(db);
  const empty: Benchmarks = { position, championId: null, patches, metrics: {} };
  if (patches.length === 0) return empty;

  const load = async (champion: number | null) => {
    const { results } = await db
      .prepare(
        `SELECT ${METRICS.join(", ")} FROM participant_stats
          WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? ${champion ? "AND champion_id = ?" : ""}`,
      )
      .bind(...patches, position, ...(champion ? [champion] : []))
      .all<Record<Metric, number | null>>();
    return results;
  };

  let rows = championId ? await load(championId) : [];
  let usedChampion: number | null = championId;
  if (rows.length < MIN_CHAMPION_GAMES) {
    rows = await load(null);
    usedChampion = null;
  }
  const metrics: Benchmarks["metrics"] = {};
  for (const metric of METRICS) {
    const values = rows.map((r) => r[metric]).filter((v): v is number => v !== null);
    if (values.length > 0) metrics[metric] = { games: values.length, quantiles: quantiles(values) };
  }
  return { position, championId: usedChampion, patches, metrics };
}

export type TierEntry = {
  championId: number;
  games: number;
  winRate: number;
  pickRate: number;
  score: number;
  tier: string;
  /** Newest patch against the one before, when both have enough games. */
  winRateChange: number | null;
};

const smoothed = (wins: number, games: number) => (wins + PRIOR_GAMES / 2) / (games + PRIOR_GAMES);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Cut-offs on the smoothed win rate, so a tier means the same however many
// champions have enough games.
const TIER_CUTS: [number, string][] = [[0.53, "S"], [0.515, "A"], [0.49, "B"], [0.475, "C"]];

function assignTiers(entries: Omit<TierEntry, "tier">[]): TierEntry[] {
  return [...entries]
    .sort((a, b) => b.score - a.score)
    .map((e) => ({ ...e, tier: TIER_CUTS.find(([cut]) => e.score >= cut)?.[1] ?? "D" }));
}

/** `position` is "" for queues without roles (ARAM, Arena, URF). */
export async function tierList(
  db: D1Database,
  position: string,
  queue = 420,
): Promise<{ patches: string[]; games: number; champions: TierEntry[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, champions: [] };
  const { results: byPatch } = await db
    .prepare(
      `SELECT champion_id, patch, games, wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND queue_id = ? AND kind = 'games'`,
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
  const total = [...byChampion.values()].reduce((sum, c) => sum + c.games, 0);
  const entries = [...byChampion.entries()]
    .filter(([, c]) => c.games >= MIN_TIER_GAMES)
    .map(([championId, c]) => ({
      championId,
      games: c.games,
      winRate: round3(c.wins / c.games),
      pickRate: round3(c.games / total),
      score: round3(smoothed(c.wins, c.games)),
      winRateChange: patchChange(patches, c.patches),
    }));
  return { patches, games: total, champions: assignTiers(entries) };
}

function patchChange(patches: string[], byPatch: Map<string, { games: number; wins: number }>): number | null {
  const [newest, previous] = patches.map((p) => byPatch.get(p));
  return newest && previous && newest.games >= MIN_TIER_GAMES && previous.games >= MIN_TIER_GAMES
    ? round3(newest.wins / newest.games - previous.wins / previous.games)
    : null;
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
): Promise<ChampionOverview | null> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return null;
  const ranked = queue === 420;
  const { results: byPosition } = await db
    .prepare(
      `SELECT team_position AS position, SUM(games) AS games FROM stat_counts
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

  const list = await tierList(db, used, queue);
  const entry = list.champions.find((c) => c.championId === championId);
  const { results: byPatch } = await db
    .prepare(
      `SELECT patch, games, wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ? AND queue_id = ? AND kind = 'games'`,
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
    pickRate: round3(games / Math.max(list.games, 1)),
    tier: entry?.tier ?? null,
    winRateChange: patchChange(patches, new Map(byPatch.map((p) => [p.patch, p]))),
    banRate: ranked ? await banRate(db, patches, championId) : null,
  };
}

async function banRate(db: D1Database, patches: string[], championId: number): Promise<number | null> {
  const [matches, banned] = await Promise.all([
    db
      .prepare(`SELECT SUM(games) AS games FROM stat_matches WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420`)
      .bind(...patches)
      .first<{ games: number | null }>(),
    db
      .prepare(
        `SELECT SUM(games) AS games FROM stat_counts
          WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND champion_id = ? AND kind = 'ban'`,
      )
      .bind(...patches, championId)
      .first<{ games: number | null }>(),
  ]);
  const games = matches?.games ?? 0;
  if (games < MIN_TIER_GAMES) return null;
  return round3((banned?.games ?? 0) / games);
}

export type Matchup = { championId: number; games: number; winRate: number };

/** The champion's win rate against each lane opponent; hardest first. */
export async function counters(
  db: D1Database,
  championId: number,
  position: string,
): Promise<{ patches: string[]; games: number; matchups: Matchup[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, matchups: [] };
  const { results } = await db
    .prepare(
      `SELECT CAST(value AS INTEGER) AS opponent, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND champion_id = ? AND team_position = ?
          AND kind = 'opponent'
        GROUP BY value`,
    )
    .bind(...patches, championId, position)
    .all<{ opponent: number; games: number; wins: number }>();
  const matchups = results
    .filter((r) => r.games >= MIN_TIER_GAMES)
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
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND kind = 'games' GROUP BY champion_id`,
    )
    .bind(...patches)
    .all<{ champion_id: number; games: number; wins: number }>();
  // Each game has ten participants, so this is the share of games a champion appears in.
  const matches = results.reduce((sum, r) => sum + r.games, 0) / 10;
  const champions = results
    .filter((r) => r.games >= MIN_TIER_GAMES)
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

export type Pace = { position: string; championId: number | null; patches: string[]; games: number; median: number[] };

// Fewer games here than for benchmarks: only games with a timeline carry a pace.
const MIN_CHAMPION_PACE_GAMES = 20;

/** Median total CS at the end of each early minute, for the role or the champion in it. */
export async function pace(db: D1Database, position: string, championId: number | null = null): Promise<Pace> {
  const patches = await latestPatches(db);
  const load = async (champion: number | null) => {
    if (patches.length === 0) return [];
    const { results } = await db
      .prepare(
        `SELECT cs_minutes FROM participant_stats
          WHERE patch IN (${placeholders(patches.length)}) AND team_position = ? AND cs_minutes IS NOT NULL
          ${champion ? "AND champion_id = ?" : ""}`,
      )
      .bind(...patches, position, ...(champion ? [champion] : []))
      .all<{ cs_minutes: string }>();
    return results.map((r) => r.cs_minutes.split(",").map(Number));
  };
  let used = championId;
  let rows = championId ? await load(championId) : [];
  if (rows.length < MIN_CHAMPION_PACE_GAMES) {
    used = null;
    rows = await load(null);
  }
  const longest = Math.max(0, ...rows.map((r) => r.length));
  const median = Array.from({ length: longest }, (_, minute) => {
    const values = rows.map((r) => r[minute]).filter((v) => v !== undefined);
    return quantiles(values)[10];
  });
  return { position, championId: used, patches, games: rows.length, median };
}

/** How the champion does with each ranked teammate; best first. */
export async function synergies(
  db: D1Database,
  championId: number,
  position: string,
): Promise<{ patches: string[]; games: number; allies: (Matchup & { position: string })[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, allies: [] };
  const { results } = await db
    .prepare(
      `SELECT value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = 420 AND champion_id = ? AND team_position = ?
          AND kind = 'ally'
        GROUP BY value`,
    )
    .bind(...patches, championId, position)
    .all<{ value: string; games: number; wins: number }>();
  const allies = results
    .filter((r) => r.games >= MIN_TIER_GAMES)
    .map((r) => {
      const [ally, allyPosition] = r.value.split(":");
      return { championId: Number(ally), position: allyPosition, games: r.games, winRate: round3(r.wins / r.games), score: smoothed(r.wins, r.games) };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ score: _, ...a }) => a);
  return { patches, games: results.reduce((sum, r) => sum + r.games, 0), allies };
}

export type AugmentStat = { augmentId: number; games: number; topFourRate: number };

export type MayhemAugment = { augmentId: number; games: number; pickRate: number; winRate: number; tier: string };

/** Per-augment counts and the number of games that had augments, for a queue and optionally a champion. */
async function augmentCounts(db: D1Database, patches: string[], queue: number, championId: number | null) {
  const { results } = await db
    .prepare(
      `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
        WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ? ${championId ? "AND champion_id = ?" : ""}
          AND kind IN ('augment', 'augmented')
        GROUP BY kind, value`,
    )
    .bind(...patches, queue, ...(championId ? [championId] : []))
    .all<{ kind: string; value: string; games: number; wins: number }>();
  const games = results.find((r) => r.kind === "augmented")?.games ?? 0;
  const augments = results.filter((r) => r.kind === "augment").map((r) => ({ augmentId: Number(r.value), games: r.games, wins: r.wins }));
  return { games, augments };
}

/**
 * ARAM Mayhem augments across all champions, tiered like champions are.
 * Served behind a flag until Riot says whether these may be shown.
 */
export async function mayhemAugments(db: D1Database): Promise<{ patches: string[]; games: number; augments: MayhemAugment[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, augments: [] };
  const { games, augments: counts } = await augmentCounts(db, patches, 2400, null);
  const augments = counts
    .filter((c) => c.games >= MIN_TIER_GAMES)
    .map((c) => ({
      augmentId: c.augmentId,
      games: c.games,
      pickRate: round3(c.games / games),
      winRate: round3(c.wins / c.games),
      score: round3(smoothed(c.wins, c.games)),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...a }) => ({ ...a, tier: TIER_CUTS.find(([cut]) => score >= cut)?.[1] ?? "D" }));
  return { patches, games, augments };
}

/**
 * Arena augment top-four rates for a champion. Riot's policy forbids showing
 * these without written approval, so the API serves them only behind a flag.
 */
export async function arenaAugments(db: D1Database, championId: number): Promise<{ patches: string[]; games: number; augments: AugmentStat[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, augments: [] };
  const { games, augments: counts } = await augmentCounts(db, patches, 1700, championId);
  const augments = counts
    .filter((c) => c.games >= MIN_TIER_GAMES)
    .map((c) => ({ augmentId: c.augmentId, games: c.games, topFourRate: round3(c.wins / c.games) }))
    .sort((a, b) => b.topFourRate - a.topFourRate);
  return { patches, games, augments };
}
