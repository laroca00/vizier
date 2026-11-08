import type { SavedBuild } from "./store";

export type ListDiff = { same: boolean; onlyA: number[]; onlyB: number[]; reordered: boolean };

/** Ids in one list but not the other; `reordered` means the same ids in a different order. */
export function diffList(a: number[], b: number[]): ListDiff {
  const count = (list: number[]) => list.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<number, number>());
  const ca = count(a);
  const cb = count(b);
  const rest = (from: Map<number, number>, other: Map<number, number>) =>
    [...from].flatMap(([id, n]) => Array<number>(Math.max(0, n - (other.get(id) ?? 0))).fill(id));
  const onlyA = rest(ca, cb);
  const onlyB = rest(cb, ca);
  const same = a.length === b.length && a.every((id, i) => id === b[i]);
  return { same, onlyA, onlyB, reordered: !same && onlyA.length === 0 && onlyB.length === 0 };
}

export type BuildDiff = {
  runes: { primaryStyle: boolean; subStyle: boolean; onlyA: number[]; onlyB: number[] };
  spells: ListDiff;
  startItems: ListDiff;
  coreItems: ListDiff;
  items: ListDiff;
  skillOrder: { same: boolean };
  /** True when nothing differs. */
  identical: boolean;
};

export function diffBuilds(a: SavedBuild, b: SavedBuild): BuildDiff {
  const perks = diffList([...a.runes.perks].sort(), [...b.runes.perks].sort());
  const spells = diffList([...a.spells].sort(), [...b.spells].sort());
  const startItems = diffList(a.startItems, b.startItems);
  const coreItems = diffList(a.coreItems, b.coreItems);
  const items = diffList(a.items, b.items);
  const skillOrder = { same: a.skillOrder.join() === b.skillOrder.join() };
  const primaryStyle = a.runes.primaryStyle !== b.runes.primaryStyle;
  const subStyle = a.runes.subStyle !== b.runes.subStyle;
  return {
    runes: { primaryStyle, subStyle, onlyA: perks.onlyA, onlyB: perks.onlyB },
    spells,
    startItems,
    coreItems,
    items: { ...items, same: items.onlyA.length === 0 && items.onlyB.length === 0 },
    skillOrder,
    identical:
      !primaryStyle && !subStyle && perks.same && spells.same && startItems.same && coreItems.same && items.onlyA.length === 0 && items.onlyB.length === 0 && skillOrder.same,
  };
}
