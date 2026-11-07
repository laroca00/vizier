// Aggregates over the crawler's rolled-up counts in stat_counts: tier lists,
// champion pages, matchups, synergies and bans, over the two newest stored
// patches. Tier lists, pick and ban rates read only the TR and EUW Emerald+
// pool (kinds "pool", "pool-ban", "pool-games"); builds and matchups use
// every crawled game.

// Shrinks small samples towards 50% so a 3-0 champion doesn't top the list.
export const sampleLimits = {
  // Win rates are pulled towards 50% as if every champion had this many more
  // games at even odds, so 17 games at 76% can't outrank 400 at 54%.
  priorGames: 200,
  // Tiers pull harder: a few hundred lucky games shouldn't make a champion S.
  tierPriorGames: 1500,
  // A champion is ranked in a role only from this many games; below it the rate is mostly luck.
  tierGames: 100,
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

function assignTiers(entries: Unranked[]): TierEntry[] {
  const reference = entries.reduce((sum, e) => sum + e.presence, 0) / Math.max(entries.length, 1);
  const prior = sampleLimits.tierPriorGames;
  return entries
    .map(({ wins, presence, ...e }) => {
      const win = (wins + prior / 2) / (e.games + prior);
      const lift = Math.max(-3, Math.min(2, Math.log2(Math.max(presence, 1e-4) / reference)));
      const score = round3(win + PRESENCE_WEIGHT * lift);
      return { ...e, score, tier: TIER_CUTS.find(([cut]) => score >= cut)?.[1] ?? "D" };
    })
    .sort((a, b) => b.score - a.score);
}

/** Pool matches in ranked and how often each champion was banned in them. */
async function poolBans(db: D1Database, patches: string[]): Promise<{ matches: number; bans: Map<number, number> }> {
  // One query per kind: an IN over two kinds makes SQLite skip stat_counts_by_kind and scan every count.
  const byKind = (kind: string) =>
    db
      .prepare(
        `SELECT champion_id, SUM(games) AS games FROM stat_counts
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
): Promise<{ patches: string[]; games: number; champions: TierEntry[] }> {
  const patches = await latestPatches(db);
  if (patches.length === 0) return { patches, games: 0, champions: [] };
  const { results: byPatch } = await db
    .prepare(
      `SELECT champion_id, patch, games, wins FROM stat_counts
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
  const total = [...byChampion.values()].reduce((sum, c) => sum + c.games, 0);
  const matches = total / slotsPerGame(queue);

  // A ban counts against every role the champion plays, so each role gets its share.
  const ranked = queue === RANKED;
  const bans = ranked ? await poolBans(db, patches) : null;
  const allRoles = new Map<number, number>();
  if (ranked) {
    const { results } = await db
      .prepare(
        `SELECT champion_id, SUM(games) AS games FROM stat_counts
          WHERE patch IN (${placeholders(patches.length)}) AND queue_id = ${RANKED} AND kind = 'pool' GROUP BY champion_id`,
      )
      .bind(...patches)
      .all<{ champion_id: number; games: number }>();
    for (const r of results) allRoles.set(r.champion_id, r.games);
  }

  const entries = [...byChampion.entries()]
    .filter(([, c]) => c.games >= sampleLimits.tierGames)
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
      };
    });
  return { patches, games: total, champions: assignTiers(entries) };
}

function patchChange(patches: string[], byPatch: Map<string, { games: number; wins: number }>): number | null {
  const [newest, previous] = patches.map((p) => byPatch.get(p));
  return newest && previous && newest.games >= sampleLimits.tierGames && previous.games >= sampleLimits.tierGames
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
  // Roles above come from every game, so builds cover KR too; the numbers below are the pool's, like the tier list.
  const { results: byPatch } = await db
    .prepare(
      `SELECT patch, games, wins FROM stat_counts
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
    banRate: ranked ? banRateOf(await poolBans(db, patches), championId) : null,
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
      `SELECT CAST(value AS INTEGER) AS opponent, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
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
    .filter((r) => r.games >= sampleLimits.pairGames)
    .map((r) => {
      const [ally, allyPosition] = r.value.split(":");
      return { championId: Number(ally), position: allyPosition, games: r.games, winRate: round3(r.wins / r.games), score: smoothed(r.wins, r.games) };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ score: _, ...a }) => a);
  return { patches, games: results.reduce((sum, r) => sum + r.games, 0), allies };
}
