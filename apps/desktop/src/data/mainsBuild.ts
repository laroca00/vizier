import type { Build, Picks } from "../api";

type Mains = NonNullable<Build["mains"]>;

/**
 * The frequent players' build is worth its own block only when it differs
 * from the popular one: other core items, or a different keystone or
 * top-five item set. Otherwise it would repeat the build above it.
 */
export function mainsDiffer(popular: Picks, mains: Mains): boolean {
  const core = (p: Picks) => p.coreItems?.ids.join(",") ?? "";
  if (core(mains) && core(popular) && core(mains) !== core(popular)) return true;
  if ((mains.runes[0]?.perks[0] ?? 0) !== (popular.runes[0]?.perks[0] ?? 0) && mains.runes[0] && popular.runes[0]) return true;
  const top = (p: Picks) => new Set(p.items.slice(0, 5).map((i) => i.id));
  const a = top(mains);
  const b = top(popular);
  return [...a].filter((id) => !b.has(id)).length >= 2;
}
