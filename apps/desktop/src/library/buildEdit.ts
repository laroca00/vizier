import type { RuneStyle } from "../data/ddragon";
import type { RuneSelection, SavedBuild } from "./store";

/** The list with the item at `from` moved to `to`; out-of-range moves leave it as it is. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Items bought twice across the core and situational lists; the starting items may repeat (two potions). */
export function duplicateItems(build: Pick<SavedBuild, "coreItems" | "items">): number[] {
  const seen = new Set<number>();
  const repeated = new Set<number>();
  for (const id of [...build.coreItems, ...build.items]) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

export type RuneIssue = "same-tree" | "primary" | "secondary" | "secondary-rows" | "shards" | "wrong-tree";

/**
 * What stops a rune page from importing: one keystone and one rune per primary
 * row, two secondary runes from different rows of another tree, three shards.
 */
export function runeIssues(runes: RuneSelection, styles: Map<number, RuneStyle>): RuneIssue[] {
  const issues: RuneIssue[] = [];
  if (runes.primaryStyle === runes.subStyle) issues.push("same-tree");
  const perks = [...runes.perks];
  while (perks.length < 9) perks.push(0);
  const primary = styles.get(runes.primaryStyle);
  const secondary = styles.get(runes.subStyle);
  const rowOf = (style: RuneStyle | undefined, id: number) => style?.slots.findIndex((slot) => slot.some((r) => r.id === id)) ?? -1;

  const primaryPerks = perks.slice(0, 4);
  if (primaryPerks.some((id) => id <= 0)) issues.push("primary");
  else if (primaryPerks.some((id, row) => rowOf(primary, id) !== row)) issues.push("wrong-tree");

  const secondaryPerks = perks.slice(4, 6);
  if (secondaryPerks.some((id) => id <= 0)) issues.push("secondary");
  else {
    const rows = secondaryPerks.map((id) => rowOf(secondary, id));
    if (rows.some((row) => row < 1)) issues.push("wrong-tree");
    else if (rows[0] === rows[1]) issues.push("secondary-rows");
  }
  if (perks.slice(6, 9).some((id) => id <= 0)) issues.push("shards");
  return issues;
}
