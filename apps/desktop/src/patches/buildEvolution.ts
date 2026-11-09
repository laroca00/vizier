import type { Build, BuildSnapshot } from "../api";

// Two builds of one champion and role, side by side: what rose, fell, arrived
// or dropped out of the most played list. Shares are out of each side's own
// games, so they stay comparable when the patches have different volume.

export type Move = "rising" | "falling" | "steady" | "new" | "gone";

/** A change in share of at least this many points counts as rising or falling. */
export const MOVE_POINTS = 0.05;

export type ItemChange = {
  id: number;
  before: { games: number; share: number; winRate: number } | null;
  after: { games: number; share: number; winRate: number } | null;
  move: Move;
};

export type Evolution = {
  items: ItemChange[];
  runes: { before: BuildSnapshot["runes"][number] | null; after: BuildSnapshot["runes"][number] | null; keystoneChanged: boolean; styleChanged: boolean };
  skills: { before: BuildSnapshot["skills"]; after: BuildSnapshot["skills"]; changed: boolean };
  core: { before: number[]; after: number[]; changed: boolean };
};

/** The current build as a snapshot, so it can be one side of the comparison. */
export function snapshotOf(build: Build): BuildSnapshot {
  return {
    patch: build.patches.join(", "),
    games: build.games,
    winRate: build.winRate,
    runes: build.runes.slice(0, 2),
    spells: build.spells[0] ?? null,
    startItems: build.startItems,
    coreItems: build.coreItems,
    items: build.items.slice(0, 8),
    skills: build.skills,
  };
}

const share = (games: number, total: number) => (total > 0 ? games / total : 0);

export function moveOf(before: number | null, after: number | null): Move {
  if (before === null) return "new";
  if (after === null) return "gone";
  const delta = after - before;
  return delta >= MOVE_POINTS ? "rising" : delta <= -MOVE_POINTS ? "falling" : "steady";
}

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function compareBuilds(before: BuildSnapshot, after: BuildSnapshot): Evolution {
  const side = (snapshot: BuildSnapshot, id: number) => {
    const item = snapshot.items.find((i) => i.id === id);
    return item ? { games: item.games, share: share(item.games, snapshot.games), winRate: item.winRate } : null;
  };
  const ids = [...new Set([...before.items.map((i) => i.id), ...after.items.map((i) => i.id)])];
  const items = ids
    .map((id): ItemChange => {
      const b = side(before, id);
      const a = side(after, id);
      return { id, before: b, after: a, move: moveOf(b?.share ?? null, a?.share ?? null) };
    })
    // Biggest movers first, then by how much the item is played now.
    .sort((x, y) => Math.abs((y.after?.share ?? 0) - (y.before?.share ?? 0)) - Math.abs((x.after?.share ?? 0) - (x.before?.share ?? 0)) || (y.after?.share ?? 0) - (x.after?.share ?? 0));
  const rb = before.runes[0] ?? null;
  const ra = after.runes[0] ?? null;
  const sb = before.skills;
  const sa = after.skills;
  return {
    items,
    runes: { before: rb, after: ra, keystoneChanged: !!rb && !!ra && rb.perks[0] !== ra.perks[0], styleChanged: !!rb && !!ra && (rb.primaryStyle !== ra.primaryStyle || rb.subStyle !== ra.subStyle) },
    skills: { before: sb, after: sa, changed: !!sb && !!sa && !sameList(sb.maxOrder, sa.maxOrder) },
    core: { before: before.coreItems?.ids ?? [], after: after.coreItems?.ids ?? [], changed: !sameList(before.coreItems?.ids ?? [], after.coreItems?.ids ?? []) },
  };
}
