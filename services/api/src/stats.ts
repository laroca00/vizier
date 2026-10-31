// Aggregates over the crawler's TR Emerald+ games: benchmarks, tier lists,
// bans. Everything reads the two newest stored patches.

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
    .prepare("SELECT patch FROM crawled_matches GROUP BY patch ORDER BY MAX(game_start) DESC LIMIT ?")
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

export type TierEntry = { championId: number; games: number; winRate: number; pickRate: number; score: number; tier: string };

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

export async function tierList(db: D1Database, position: string): Promise<{ patches: string[]; games: number; champions: TierEntry[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, champions: [] };
  const { results } = await db
    .prepare(
      `SELECT champion_id, COUNT(*) AS games, SUM(win) AS wins FROM participant_stats
        WHERE patch IN (${placeholders(patches.length)}) AND team_position = ?
        GROUP BY champion_id`,
    )
    .bind(...patches, position)
    .all<{ champion_id: number; games: number; wins: number }>();
  const total = results.reduce((sum, r) => sum + r.games, 0);
  const entries = results
    .filter((r) => r.games >= MIN_TIER_GAMES)
    .map((r) => ({
      championId: r.champion_id,
      games: r.games,
      winRate: round3(r.wins / r.games),
      pickRate: round3(r.games / total),
      score: round3(smoothed(r.wins, r.games)),
    }));
  return { patches, games: total, champions: assignTiers(entries) };
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
};

export async function championOverview(db: D1Database, championId: number, position: string | null): Promise<ChampionOverview | null> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return null;
  const { results: byPosition } = await db
    .prepare(
      `SELECT team_position AS position, COUNT(*) AS games FROM participant_stats
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position != ''
        GROUP BY team_position ORDER BY games DESC`,
    )
    .bind(...patches, championId)
    .all<{ position: string; games: number }>();
  const played = byPosition.reduce((sum, p) => sum + p.games, 0);
  if (played === 0) return null;
  const positions = byPosition.map((p) => ({ ...p, share: round3(p.games / played) }));
  const used = position && positions.some((p) => p.position === position) ? position : positions[0].position;

  const { results: byPatch } = await db
    .prepare(
      `SELECT patch, COUNT(*) AS games, SUM(win) AS wins FROM participant_stats
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ?
        GROUP BY patch`,
    )
    .bind(...patches, championId, used)
    .all<{ patch: string; games: number; wins: number }>();
  const games = byPatch.reduce((sum, p) => sum + p.games, 0);
  const wins = byPatch.reduce((sum, p) => sum + p.wins, 0);
  const [newest, previous] = patches.map((patch) => byPatch.find((p) => p.patch === patch));
  const winRateChange =
    newest && previous && newest.games >= MIN_TIER_GAMES && previous.games >= MIN_TIER_GAMES
      ? round3(newest.wins / newest.games - previous.wins / previous.games)
      : null;

  const list = await tierList(db, used);
  const entry = list.champions.find((c) => c.championId === championId);
  return {
    patches,
    positions,
    position: used,
    games,
    winRate: round3(wins / games),
    pickRate: round3(games / Math.max(list.games, 1)),
    tier: entry?.tier ?? null,
    winRateChange,
  };
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
      `SELECT opponent_champion_id AS opponent, COUNT(*) AS games, SUM(win) AS wins FROM participant_stats
        WHERE patch IN (${placeholders(patches.length)}) AND champion_id = ? AND team_position = ?
          AND opponent_champion_id IS NOT NULL
        GROUP BY opponent_champion_id`,
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
      `SELECT champion_id, COUNT(*) AS games, SUM(win) AS wins FROM participant_stats
        WHERE patch IN (${placeholders(patches.length)}) GROUP BY champion_id`,
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
