import type { Champion } from "./data/ddragon";

// Rough spread of each level-one stat among champions, so no single stat dominates the distance.
const SCALE = { hp: 60, armor: 8, mr: 6, ad: 8, speed: 30, range: 300 } as const;

function features(c: Champion) {
  const s = c.baseStats;
  if (!s) return null;
  return [s.hp / SCALE.hp, s.armor / SCALE.armor, s.mr / SCALE.mr, s.ad / SCALE.ad, s.speed / SCALE.speed, (c.attackRange ?? 0) / SCALE.range];
}

/** Euclidean distance over level-one stats; null when either side has no stats. */
export function statDistance(a: Champion, b: Champion): number | null {
  const fa = features(a);
  const fb = features(b);
  if (!fa || !fb) return null;
  return Math.sqrt(fa.reduce((sum, v, i) => sum + (v - fb[i]) ** 2, 0));
}

/** Champions with the same main class and damage type, nearest base stats first. */
export function similarChampions(self: Champion, candidates: Champion[], limit: number): Champion[] {
  return candidates
    .filter((c) => c.key !== self.key && c.tags[0] === self.tags[0] && c.magic === self.magic)
    .map((c) => ({ c, d: statDistance(self, c) }))
    .filter((x): x is { c: Champion; d: number } => x.d !== null)
    .sort((a, b) => a.d - b.d || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}
