import { aggregateBuild, type Build, type RunePage } from "./builds.ts";

// A closed patch's builds, kept small: what the Build Evolution view compares
// across patches. Written once per patch, from the counts that still exist
// while the patch is the second newest.

const RANKED = 420;
// A newest patch with fewer games than `newestGames` may be a few stray late games, not a real switch.
// Builds with fewer than `buildGames` are not worth keeping. Tests lower both.
export const snapshotLimits = { newestGames: 300, buildGames: 30 };
const TOP_RUNES = 2;
const TOP_ITEMS = 8;

type Choice<T> = T & { games: number; winRate: number };

export type BuildSnapshot = {
  patch: string;
  games: number;
  winRate: number;
  runes: Choice<RunePage>[];
  spells: Choice<{ ids: number[] }> | null;
  startItems: Choice<{ ids: number[] }> | null;
  coreItems: Choice<{ ids: number[] }> | null;
  items: Choice<{ id: number }>[];
  skills: Choice<{ maxOrder: number[]; firstLevels: number[] }> | null;
};

export function compactBuild(patch: string, build: Build): BuildSnapshot {
  return {
    patch,
    games: build.games,
    winRate: build.winRate,
    runes: build.runes.slice(0, TOP_RUNES),
    spells: build.spells[0] ?? null,
    startItems: build.startItems,
    coreItems: build.coreItems,
    items: build.items.slice(0, TOP_ITEMS),
    skills: build.skills,
  };
}

/**
 * Snapshots the second newest patch once, when the newest has real volume and
 * nothing of the older one is stored yet. Returns the number of rows written.
 */
export async function snapshotClosedPatch(db: D1Database): Promise<number> {
  const { results: patches } = await db
    .prepare("SELECT patch, SUM(games) AS games FROM stat_matches GROUP BY patch ORDER BY MAX(last_start) DESC LIMIT 2")
    .all<{ patch: string; games: number }>();
  if (patches.length < 2 || patches[0].games < snapshotLimits.newestGames) return 0;
  const closed = patches[1].patch;
  const done = await db.prepare("SELECT 1 AS one FROM build_snapshots WHERE patch = ? LIMIT 1").bind(closed).first();
  if (done) return 0;

  const { results: lanes } = await db
    .prepare("SELECT DISTINCT champion_id, team_position FROM stat_counts WHERE patch = ? AND queue_id = ? AND kind = 'games' AND team_position != ''")
    .bind(closed, RANKED)
    .all<{ champion_id: number; team_position: string }>();
  const insert = db.prepare("INSERT OR IGNORE INTO build_snapshots (patch, champion_id, team_position, body) VALUES (?, ?, ?, ?)");
  const rows = [];
  for (const { champion_id: championId, team_position: position } of lanes) {
    const build = await aggregateBuild(db, championId, position, null, RANKED, closed);
    if (!build || build.games < snapshotLimits.buildGames) continue;
    rows.push(insert.bind(closed, championId, position, JSON.stringify(compactBuild(closed, build))));
  }
  if (rows.length > 0) await db.batch(rows);
  return rows.length;
}

export type BuildHistory = { snapshots: BuildSnapshot[] };

/** Every stored snapshot of one champion and role, newest patch first. */
export async function buildHistory(db: D1Database, championId: number, position: string): Promise<BuildHistory | null> {
  const { results } = await db
    .prepare("SELECT patch, body FROM build_snapshots WHERE champion_id = ? AND team_position = ?")
    .bind(championId, position)
    .all<{ patch: string; body: string }>();
  if (results.length === 0) return null;
  const snapshots = results.map((r) => JSON.parse(r.body) as BuildSnapshot).sort((a, b) => comparePatch(b.patch, a.patch));
  return { snapshots };
}

/** "16.10" is newer than "16.9". */
export function comparePatch(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
  const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}
