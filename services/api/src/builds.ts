// Below this many games a newest patch is too thin, so older stored patches join in.
const MIN_GAMES_FOR_PATCH = 30;
const TOP_RUNES = 3;
const TOP_SPELLS = 2;
const TOP_ITEMS = 15;

export const POSITIONS = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

export type RunePage = { primaryStyle: number; subStyle: number; perks: number[] };

type Choice<T> = T & { games: number; winRate: number };

export type Build = {
  patches: string[];
  games: number;
  winRate: number;
  runes: Choice<RunePage>[];
  spells: Choice<{ ids: number[] }>[];
  items: Choice<{ id: number }>[];
};

/** Inverse of crawler's runeKey; perks come out in LCU order: 4 primary, 2 secondary, 3 shards. */
export function parseRuneKey(key: string): RunePage {
  const [primary, sub, primaryPerks, subPerks, shards] = key.split(":");
  return {
    primaryStyle: Number(primary),
    subStyle: Number(sub),
    perks: [primaryPerks, subPerks, shards].flatMap((group) => group.split(",").map(Number)),
  };
}

const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 1000) / 1000 : 0);

export async function aggregateBuild(db: D1Database, championId: number, position: string | null): Promise<Build | null> {
  const { results: patchRows } = await db
    .prepare("SELECT patch FROM crawled_matches GROUP BY patch ORDER BY MAX(game_start) DESC")
    .all<{ patch: string }>();
  if (patchRows.length === 0) return null;

  const filter = position ? "AND team_position = ?" : "";
  const query = (patches: string[]) =>
    db
      .prepare(
        `SELECT win, runes, spells, items FROM participant_stats
          WHERE patch IN (${patches.map(() => "?").join(",")}) AND champion_id = ? ${filter}`,
      )
      .bind(...patches, championId, ...(position ? [position] : []))
      .all<{ win: number; runes: string; spells: string; items: string }>();

  let patches = [patchRows[0].patch];
  let { results: rows } = await query(patches);
  if (rows.length < MIN_GAMES_FOR_PATCH && patchRows.length > 1) {
    patches = patchRows.map((p) => p.patch);
    ({ results: rows } = await query(patches));
  }
  if (rows.length === 0) return null;

  const tally = (key: (row: (typeof rows)[number]) => string[]) => {
    const counts = new Map<string, { games: number; wins: number }>();
    for (const row of rows) {
      for (const k of key(row)) {
        const c = counts.get(k) ?? { games: 0, wins: 0 };
        c.games++;
        c.wins += row.win;
        counts.set(k, c);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].games - a[1].games);
  };

  const wins = rows.reduce((sum, r) => sum + r.win, 0);
  return {
    patches,
    games: rows.length,
    winRate: rate(wins, rows.length),
    runes: tally((r) => [r.runes])
      .slice(0, TOP_RUNES)
      .map(([key, c]) => ({ ...parseRuneKey(key), games: c.games, winRate: rate(c.wins, c.games) })),
    spells: tally((r) => [r.spells])
      .slice(0, TOP_SPELLS)
      .map(([key, c]) => ({ ids: key.split(",").map(Number), games: c.games, winRate: rate(c.wins, c.games) })),
    // An item counts once per game even when bought twice.
    items: tally((r) => [...new Set(r.items.split(",").filter(Boolean))])
      .slice(0, TOP_ITEMS)
      .map(([id, c]) => ({ id: Number(id), games: c.games, winRate: rate(c.wins, c.games) })),
  };
}
