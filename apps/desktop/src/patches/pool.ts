import type { EntityDiff } from "./diff";

/** Champions the player cares about first; everything else keeps its order. */
export function poolFirst(entries: EntityDiff[], mine: Set<string>): EntityDiff[] {
  const mineFirst = (e: EntityDiff) => (e.kind === "champion" && mine.has(e.id) ? 0 : 1);
  return entries.map((e, i) => ({ e, i })).sort((a, b) => mineFirst(a.e) - mineFirst(b.e) || a.i - b.i).map(({ e }) => e);
}

/** Ids of the player's champions the patch changed. */
export function changedOf(entries: EntityDiff[], mine: Set<string>): Set<string> {
  return new Set(entries.filter((e) => e.kind === "champion" && e.status === "changed" && mine.has(e.id)).map((e) => e.id));
}
