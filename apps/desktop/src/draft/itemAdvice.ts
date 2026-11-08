import type { Champion } from "../data/ddragon";
import { traitsOf } from "../data/traits";

export type ItemRule = "antiHeal" | "magicResist" | "armor" | "crowdControl" | "burst" | "tanks";

export type ItemAdvice = {
  rule: ItemRule;
  /** Turkish template; {names} or {count} are filled by the caller after translation. */
  reason: string;
  names: string[];
  /** Items from the champion's own item pool, best fit first. */
  items: number[];
};

// Data Dragon ids, ordered by how often the item is the right answer for the rule.
const ANTI_HEAL = [3165, 3033, 6609, 3075, 3076, 3123, 3916];
const MAGIC_RESIST = [3156, 3102, 4401, 3065, 3091, 3194, 3140, 3139];
const ARMOR = [3143, 3110, 3075, 6333, 3047, 3742, 3026, 3157];
const CLEANSE = [3139, 3140, 3111];
const SURVIVE = [3157, 3026, 3814, 6333, 3156, 3102];
const PENETRATION = [3135, 6653, 3036, 6694, 3153, 3071, 3033, 4633];

const MIN_ENEMIES = 3;

const RULES: {
  rule: ItemRule;
  reason: string;
  items: number[];
  /** Enemies that trigger the rule when there are enough of them. */
  hit: (enemy: Champion, tr: ReturnType<typeof traitsOf>) => boolean;
  need: number;
}[] = [
  { rule: "antiHeal", reason: "{names} iyileşme ve can çalma sağlıyor; yara açan eşya işe yarar.", items: ANTI_HEAL, need: 1, hit: (_, tr) => tr.healing },
  { rule: "magicResist", reason: "{count} rakip ağırlıklı büyü hasarı veriyor: {names}.", items: MAGIC_RESIST, need: 3, hit: (_, tr) => tr.magic >= 0.6 },
  { rule: "armor", reason: "{count} rakip ağırlıklı fiziksel hasar veriyor: {names}.", items: ARMOR, need: 3, hit: (_, tr) => tr.magic <= 0.4 },
  { rule: "crowdControl", reason: "{count} rakipte sert kontrol var: {names}.", items: CLEANSE, need: 3, hit: (_, tr) => tr.hardCc },
  { rule: "burst", reason: "Ani patlayan rakipler var: {names}.", items: SURVIVE, need: 2, hit: (_, tr) => tr.burst },
  { rule: "tanks", reason: "{count} rakip tank: {names}. Yüzde can ve delme eşyaları değer kazanır.", items: PENETRATION, need: 2, hit: (_, tr) => tr.tank },
];

/**
 * Item answers to the enemy draft. Only items the champion's own builds buy
 * are suggested, so a marksman is never told to buy a mage item.
 */
export function itemAdvice(enemies: Champion[], pool: Set<number>): ItemAdvice[] {
  if (enemies.length < MIN_ENEMIES) return [];
  const traits = enemies.map((enemy) => ({ enemy, tr: traitsOf(enemy) }));
  return RULES.flatMap((rule) => {
    const hits = traits.filter(({ enemy, tr }) => rule.hit(enemy, tr));
    if (hits.length < rule.need) return [];
    const items = rule.items.filter((id) => pool.has(id));
    if (items.length === 0) return [];
    return [{ rule: rule.rule, reason: rule.reason, names: hits.map(({ enemy }) => enemy.name), items: items.slice(0, 3) }];
  });
}
