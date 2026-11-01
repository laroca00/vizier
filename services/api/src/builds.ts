// Below this many games a newest patch is too thin, so older stored patches join in.
const MIN_GAMES_FOR_PATCH = 30;
// Below this many games a matchup says more about luck than the matchup.
const MIN_MATCHUP_GAMES = 15;
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

const ids = (csv: string) => csv.split(",").filter(Boolean).map(Number);

type Count = { kind: string; value: string; games: number; wins: number };

/**
 * The most picked runes, spells and items for a champion, from rolled-up
 * counts. Starting items, core items and skills come from the games that had
 * a timeline. With `vs`, the numbers are for that lane matchup when it has
 * enough games.
 */
export async function aggregateBuild(
  db: D1Database,
  championId: number,
  position: string | null,
  vs: number | null = null,
  queue = 420,
): Promise<Build | null> {
  const { results: patchRows } = await db
    .prepare("SELECT patch FROM stat_matches GROUP BY patch ORDER BY MAX(last_start) DESC")
    .all<{ patch: string }>();
  if (patchRows.length === 0) return null;

  const query = (patches: string[], kinds: string, extra: string, binds: unknown[]) =>
    db
      .prepare(
        `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM stat_counts
          WHERE patch IN (${patches.map(() => "?").join(",")}) AND queue_id = ? AND champion_id = ?
            ${position ? "AND team_position = ?" : ""} AND kind IN (${kinds}) ${extra}
          GROUP BY kind, value ORDER BY games DESC, value`,
      )
      .bind(...patches, queue, championId, ...(position ? [position] : []), ...binds)
      .all<Count>();

  const gamesIn = async (patches: string[], opponent: number | null) => {
    const { results } = opponent
      ? await query(patches, "'opponent'", "AND value = ?", [String(opponent)])
      : await query(patches, "'games'", "", []);
    return results.reduce((sum, r) => ({ games: sum.games + r.games, wins: sum.wins + r.wins }), { games: 0, wins: 0 });
  };

  const load = async (opponent: number | null) => {
    let patches = [patchRows[0].patch];
    let total = await gamesIn(patches, opponent);
    if (total.games < MIN_GAMES_FOR_PATCH && patchRows.length > 1) {
      patches = patchRows.map((p) => p.patch);
      total = await gamesIn(patches, opponent);
    }
    return { patches, total };
  };

  let used: number | null = vs;
  let { patches, total } = await load(vs);
  if (vs && total.games < MIN_MATCHUP_GAMES) {
    used = null;
    ({ patches, total } = await load(null));
  }
  if (total.games === 0) return null;

  // Matchup counts carry the opponent in front of the value: "238|8112:8000:...".
  const kinds = ["rune", "spell", "item", "start", "core", "skill"];
  const { results } = used
    ? await query(patches, kinds.map((k) => `'vs-${k}'`).join(","), "AND value >= ? AND value < ?", [`${used}|`, `${used}}`])
    : await query(patches, kinds.map((k) => `'${k}'`).join(","), "", []);
  const top = (kind: string) =>
    results
      .filter((r) => r.kind === (used ? `vs-${kind}` : kind))
      .map((r) => ({ ...r, value: used ? r.value.slice(r.value.indexOf("|") + 1) : r.value }));
  const choice = <T>(row: Count | undefined, shape: (value: string) => T) =>
    row ? { ...shape(row.value), games: row.games, winRate: rate(row.wins, row.games) } : null;

  return {
    patches,
    games: total.games,
    winRate: rate(total.wins, total.games),
    vs: used,
    runes: top("rune")
      .slice(0, TOP_RUNES)
      .map((r) => ({ ...parseRuneKey(r.value), games: r.games, winRate: rate(r.wins, r.games) })),
    spells: top("spell")
      .slice(0, TOP_SPELLS)
      .map((r) => ({ ids: ids(r.value), games: r.games, winRate: rate(r.wins, r.games) })),
    items: top("item")
      .slice(0, TOP_ITEMS)
      .map((r) => ({ id: Number(r.value), games: r.games, winRate: rate(r.wins, r.games) })),
    startItems: choice(top("start")[0], (value) => ({ ids: ids(value) })),
    coreItems: choice(top("core")[0], (value) => ({ ids: ids(value) })),
    skills: choice(top("skill")[0], (value) => {
      const [order, first] = value.split("|");
      return { maxOrder: [...order].map(Number), firstLevels: [...first].map(Number) };
    }),
  };
}
