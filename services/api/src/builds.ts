import { finishedItems } from "./ddragon.ts";

// Below this many games a newest patch is too thin, so older stored patches join in.
const MIN_GAMES_FOR_PATCH = 30;
// Below this many games a matchup says more about luck than the matchup.
const MIN_MATCHUP_GAMES = 15;
const TOP_RUNES = 3;
const TOP_SPELLS = 2;
const TOP_ITEMS = 15;
const CORE_ITEMS = 3;

export const POSITIONS = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

export type RunePage = { primaryStyle: number; subStyle: number; perks: number[] };

type Choice<T> = T & { games: number; winRate: number };

export type Build = {
  patches: string[];
  games: number;
  winRate: number;
  /** The opponent the numbers are for, or null when they cover every matchup. */
  vs: number | null;
  runes: Choice<RunePage>[];
  spells: Choice<{ ids: number[] }>[];
  items: Choice<{ id: number }>[];
  startItems: Choice<{ ids: number[] }> | null;
  coreItems: Choice<{ ids: number[] }> | null;
  /** Skill slots (1 Q, 2 W, 3 E) in the order they are maxed, and the first three level-ups. */
  skills: Choice<{ maxOrder: number[]; firstLevels: number[] }> | null;
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

/** "1213..." level-up slots to the order Q, W and E reach their last rank. */
export function maxOrder(skillOrder: string): number[] {
  const ranks = new Map<number, number>();
  const maxedAt = new Map<number, number>();
  [...skillOrder].map(Number).forEach((slot, i) => {
    if (slot < 1 || slot > 3) return;
    const rank = (ranks.get(slot) ?? 0) + 1;
    ranks.set(slot, rank);
    if (rank === 5) maxedAt.set(slot, i);
  });
  // Slots not maxed by level 18 go last, in order of how far they got.
  return [1, 2, 3].sort((a, b) => (maxedAt.get(a) ?? 100 - (ranks.get(a) ?? 0)) - (maxedAt.get(b) ?? 100 - (ranks.get(b) ?? 0)));
}

const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 1000) / 1000 : 0);

type Row = {
  win: number;
  runes: string;
  spells: string;
  items: string;
  start_items: string | null;
  skill_order: string | null;
  purchase_order: string | null;
};

function tally(rows: Row[], key: (row: Row) => string[]) {
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
}

const ids = (csv: string) => csv.split(",").filter(Boolean).map(Number);

export async function aggregateBuild(
  db: D1Database,
  championId: number,
  position: string | null,
  vs: number | null = null,
  loadFinished: () => Promise<Set<number>> = finishedItems,
  queue = 420,
): Promise<Build | null> {
  const { results: patchRows } = await db
    .prepare("SELECT patch FROM crawled_matches GROUP BY patch ORDER BY MAX(game_start) DESC")
    .all<{ patch: string }>();
  if (patchRows.length === 0) return null;

  const query = (patches: string[], opponent: number | null) => {
    const filters = ["AND queue_id = ?", position ? "AND team_position = ?" : "", opponent ? "AND opponent_champion_id = ?" : ""].join(" ");
    return db
      .prepare(
        `SELECT win, runes, spells, items, start_items, skill_order, purchase_order FROM participant_stats
          WHERE patch IN (${patches.map(() => "?").join(",")}) AND champion_id = ? ${filters}`,
      )
      .bind(...patches, championId, queue, ...(position ? [position] : []), ...(opponent ? [opponent] : []))
      .all<Row>();
  };

  const load = async (opponent: number | null) => {
    let patches = [patchRows[0].patch];
    let { results } = await query(patches, opponent);
    if (results.length < MIN_GAMES_FOR_PATCH && patchRows.length > 1) {
      patches = patchRows.map((p) => p.patch);
      ({ results } = await query(patches, opponent));
    }
    return { patches, rows: results };
  };

  let used: number | null = vs;
  let { patches, rows } = await load(vs);
  if (vs && rows.length < MIN_MATCHUP_GAMES) {
    used = null;
    ({ patches, rows } = await load(null));
  }
  if (rows.length === 0) return null;

  const choice = <T>(top: [string, { games: number; wins: number }] | undefined, shape: (key: string) => T) =>
    top ? { ...shape(top[0]), games: top[1].games, winRate: rate(top[1].wins, top[1].games) } : null;

  const withPath = rows.filter((r) => r.skill_order);
  const finished = withPath.length > 0 ? await loadFinished().catch(() => null) : null;
  const core = (purchases: string) => {
    const seen: number[] = [];
    for (const id of ids(purchases)) if (finished?.has(id) && !seen.includes(id) && seen.length < CORE_ITEMS) seen.push(id);
    return seen.length === CORE_ITEMS ? [seen.join(",")] : [];
  };

  const wins = rows.reduce((sum, r) => sum + r.win, 0);
  return {
    patches,
    games: rows.length,
    winRate: rate(wins, rows.length),
    vs: used,
    runes: tally(rows, (r) => [r.runes])
      .slice(0, TOP_RUNES)
      .map(([key, c]) => ({ ...parseRuneKey(key), games: c.games, winRate: rate(c.wins, c.games) })),
    spells: tally(rows, (r) => [r.spells])
      .slice(0, TOP_SPELLS)
      .map(([key, c]) => ({ ids: ids(key), games: c.games, winRate: rate(c.wins, c.games) })),
    // An item counts once per game even when bought twice.
    items: tally(rows, (r) => [...new Set(r.items.split(",").filter(Boolean))])
      .slice(0, TOP_ITEMS)
      .map(([id, c]) => ({ id: Number(id), games: c.games, winRate: rate(c.wins, c.games) })),
    startItems: choice(
      tally(withPath, (r) => (r.start_items ? [ids(r.start_items).sort((a, b) => a - b).join(",")] : []))[0],
      (key) => ({ ids: ids(key) }),
    ),
    coreItems: finished ? choice(tally(withPath, (r) => core(r.purchase_order ?? ""))[0], (key) => ({ ids: ids(key) })) : null,
    skills: choice(
      tally(withPath, (r) => [`${maxOrder(r.skill_order!).join("")}|${r.skill_order!.slice(0, 3)}`])[0],
      (key) => {
        const [order, first] = key.split("|");
        return { maxOrder: [...order].map(Number), firstLevels: [...first].map(Number) };
      },
    ),
  };
}
