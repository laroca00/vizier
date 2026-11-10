import { DEFAULT_BRACKET, type Bracket } from "@vizier/shared/brackets";
import type { Foe, Style } from "./archetypes.ts";
import { scope } from "./localSchema.ts";

// Below this many games a newest patch is too thin, so older stored patches join in.
const MIN_GAMES_FOR_PATCH = 30;
// Below this many games a matchup says more about luck than the matchup.
const MIN_MATCHUP_GAMES = 15;
const TOP_RUNES = 3;
// Spell pairs and items beyond the first are for comparison tables; the first stays what the build imports.
const TOP_SPELLS = 4;
const TOP_ITEMS = 24;
const TOP_SKILLS = 3;
const MAX_PERKS = 70;
// A build style is shown on its own when this many games and this share of the champion's games use it.
const MIN_VARIANT_GAMES = 20;
const MIN_VARIANT_SHARE = 0.08;
const MAX_VARIANTS = 4;
// Situational items: games against that kind of team, games with the item, and how much more often it is bought there.
const MIN_FOE_GAMES = 15;
const MIN_FOE_ITEM_GAMES = 5;
const MIN_LIFT = 1.3;
const SITUATIONAL_ITEMS = 4;

export const POSITIONS = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

export type RunePage = { primaryStyle: number; subStyle: number; perks: number[] };

type Choice<T> = T & { games: number; winRate: number };

type Picks = {
  runes: Choice<RunePage>[];
  spells: Choice<{ ids: number[] }>[];
  items: Choice<{ id: number }>[];
  startItems: Choice<{ ids: number[] }> | null;
  coreItems: Choice<{ ids: number[] }> | null;
  /** Skill slots (1 Q, 2 W, 3 E) in the order they are maxed, and the first three level-ups. */
  skills: Choice<{ maxOrder: number[]; firstLevels: number[] }> | null;
};

/** Runes, items and skills of the games built one way, say AP or crit. */
export type Variant = Picks & { style: Style; games: number; winRate: number; share: number };

export type Build = Picks & {
  patches: string[];
  games: number;
  winRate: number;
  /** The opponent the numbers are for, or null when they cover every matchup. */
  vs: number | null;
  /** Build styles with enough games, most played first. Empty for matchup builds. */
  variants: Variant[];
  /** Items bought more often against magic-heavy, physical-heavy or tanky teams. */
  situational: { vs: Foe; games: number; items: Choice<{ id: number }>[] }[];
  /** How often each single rune (and shard) was taken in the champion's games. Empty for matchup builds. */
  perks: Choice<{ id: number }>[];
  /** Games the perk counts come from, which is fewer than `games` while older games lack them. */
  perkGames: number;
  /** The most played skill orders; `share` is out of the games that had a timeline. */
  skillOptions: Choice<{ maxOrder: number[]; firstLevels: number[]; share: number }>[];
  /** First, second and third completed item as a tree, the most played branches first. Empty for matchup builds. */
  itemTree: ItemNode[];
};

export type ItemNode = { id: number; games: number; winRate: number; next: ItemNode[] };

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
  /** Build from this one patch only, without falling back to the older one; for snapshots of a closed patch. */
  onlyPatch?: string,
  bracket: Bracket = DEFAULT_BRACKET,
): Promise<Build | null> {
  const { results: patchRows } = await db
    .prepare("SELECT patch FROM stat_matches GROUP BY patch ORDER BY MAX(last_start) DESC")
    .all<{ patch: string }>();
  if (patchRows.length === 0) return null;

  const query = (patches: string[], kinds: string, extra: string, binds: unknown[]) =>
    db
      .prepare(
        `SELECT kind, value, SUM(games) AS games, SUM(wins) AS wins FROM ${scope("stat_counts", bracket)}
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
    let patches = [onlyPatch ?? patchRows[0].patch];
    let total = await gamesIn(patches, opponent);
    if (!onlyPatch && total.games < MIN_GAMES_FOR_PATCH && patchRows.length > 1) {
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

  // Matchup and style counts carry a prefix in front of the value: "238|8112:8000:...", "crit|3031".
  const kinds = ["rune", "spell", "item", "start", "core", "skill"];
  const { results } = used
    ? await query(patches, kinds.map((k) => `'vs-${k}'`).join(","), "AND value >= ? AND value < ?", [`${used}|`, `${used}}`])
    : await query(patches, [...kinds.map((k) => `'${k}'`), ...kinds.map((k) => `'s-${k}'`), "'style'", "'foe'", "'foe-item'", "'perk'", "'path1'", "'path2'", "'path3'"].join(","), "", []);
  const unprefixed = (kind: string, prefix?: string) =>
    results
      .filter((r) => r.kind === kind && (prefix === undefined || r.value.startsWith(`${prefix}|`)))
      .map((r) => (prefix === undefined ? r : { ...r, value: r.value.slice(prefix.length + 1) }));
  const base = (kind: string) => (used ? unprefixed(`vs-${kind}`, String(used)) : unprefixed(kind));

  const build: Build = {
    patches,
    games: total.games,
    winRate: rate(total.wins, total.games),
    vs: used,
    ...picks(base, !used),
    variants: [],
    situational: [],
    perks: [],
    perkGames: 0,
    skillOptions: [],
    itemTree: [],
  };
  if (used) return build;

  build.perkGames = unprefixed("perk").find((r) => r.value === "0")?.games ?? 0;
  build.perks = unprefixed("perk")
    .filter((r) => r.value !== "0")
    .slice(0, MAX_PERKS)
    .map((r) => ({ id: Number(r.value), games: r.games, winRate: rate(r.wins, r.games) }));
  build.itemTree = itemTree(unprefixed("path1"), unprefixed("path2"), unprefixed("path3"));
  const skillRows = unprefixed("skill");
  const skillGames = skillRows.reduce((sum, r) => sum + r.games, 0);
  build.skillOptions = skillRows.slice(0, TOP_SKILLS).map((r) => {
    const [order, first] = r.value.split("|");
    return { maxOrder: [...order].map(Number), firstLevels: [...first].map(Number), games: r.games, winRate: rate(r.wins, r.games), share: rate(r.games, skillGames) };
  });

  build.variants = unprefixed("style")
    .filter((r) => r.games >= MIN_VARIANT_GAMES && r.games / total.games >= MIN_VARIANT_SHARE)
    .slice(0, MAX_VARIANTS)
    .map((r) => ({
      style: r.value as Style,
      games: r.games,
      winRate: rate(r.wins, r.games),
      share: rate(r.games, total.games),
      ...picks((kind) => unprefixed(`s-${kind}`, r.value), false),
    }));

  const itemShare = new Map(unprefixed("item").map((r) => [r.value, r.games / total.games]));
  const core = new Set(build.coreItems?.ids.map(String));
  for (const foe of unprefixed("foe").filter((r) => r.games >= MIN_FOE_GAMES)) {
    const items = unprefixed("foe-item", foe.value)
      .filter((r) => r.games >= MIN_FOE_ITEM_GAMES && !core.has(r.value))
      .map((r) => ({ ...r, lift: r.games / foe.games / (itemShare.get(r.value) ?? 1) }))
      .filter((r) => r.lift >= MIN_LIFT)
      .sort((a, b) => b.lift - a.lift || b.games - a.games)
      .slice(0, SITUATIONAL_ITEMS)
      .map((r) => ({ id: Number(r.value), games: r.games, winRate: rate(r.wins, r.games) }));
    if (items.length > 0) build.situational.push({ vs: foe.value as Foe, games: foe.games, items });
  }
  return build;
}

// Matchup builds are many per champion and share one stored row, so they keep the shorter lists.
function picks(rows: (kind: string) => Count[], wide = true): Picks {
  const choice = <T>(row: Count | undefined, shape: (value: string) => T) =>
    row ? { ...shape(row.value), games: row.games, winRate: rate(row.wins, row.games) } : null;
  return {
    runes: rows("rune")
      .slice(0, TOP_RUNES)
      .map((r) => ({ ...parseRuneKey(r.value), games: r.games, winRate: rate(r.wins, r.games) })),
    spells: rows("spell")
      .slice(0, wide ? TOP_SPELLS : 2)
      .map((r) => ({ ids: ids(r.value), games: r.games, winRate: rate(r.wins, r.games) })),
    items: rows("item")
      .slice(0, wide ? TOP_ITEMS : 15)
      .map((r) => ({ id: Number(r.value), games: r.games, winRate: rate(r.wins, r.games) })),
    startItems: choice(rows("start")[0], (value) => ({ ids: ids(value) })),
    coreItems: choice(rows("core")[0], (value) => ({ ids: ids(value) })),
    skills: choice(rows("skill")[0], (value) => {
      const [order, first] = value.split("|");
      return { maxOrder: [...order].map(Number), firstLevels: [...first].map(Number) };
    }),
  };
}

const TREE_BRANCHES = 3;
const MIN_BRANCH_GAMES = 20;

type PathCount = { value: string; games: number; wins: number };

/** Top branches per level; a branch needs enough games to mean anything, and only follows a branch that was itself kept. */
export function itemTree(first: PathCount[], second: PathCount[], third: PathCount[]): ItemNode[] {
  const grow = (prefix: string, level: PathCount[]): ItemNode[] =>
    level
      .filter((r) => r.games >= MIN_BRANCH_GAMES && (prefix === "" ? !r.value.includes(",") : r.value.startsWith(`${prefix},`) && r.value.split(",").length === prefix.split(",").length + 1))
      .sort((a, b) => b.games - a.games || a.value.localeCompare(b.value))
      .slice(0, TREE_BRANCHES)
      .map((r) => ({ id: Number(r.value.split(",").pop()), games: r.games, winRate: rate(r.wins, r.games), next: [], key: r.value }) as ItemNode & { key: string });
  const levels = [second, third];
  const attach = (nodes: (ItemNode & { key: string })[], depth: number) => {
    for (const node of nodes) {
      if (depth >= levels.length) continue;
      node.next = grow(node.key, levels[depth]);
      attach(node.next as (ItemNode & { key: string })[], depth + 1);
    }
    return nodes;
  };
  const roots = attach(grow("", first) as (ItemNode & { key: string })[], 0);
  const strip = (nodes: (ItemNode & { key?: string })[]): ItemNode[] => nodes.map(({ key: _key, ...node }) => ({ ...node, next: strip(node.next as (ItemNode & { key?: string })[]) }));
  return strip(roots);
}
