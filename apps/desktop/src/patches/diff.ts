// Compares two Data Dragon versions. Data Dragon publishes numbers, not
// intent: base stats, ability cooldowns, costs and ranges, item stats,
// prices and recipes, and which runes exist. Damage numbers inside ability
// text and system changes are not in it, and the page says so.

import { statAt, type DuelStat } from "../data/duel";

export type Value = number | string | null;
/** `field` is a code the page turns into words: "stat:hp", "spell:Q:cooldown", "item:gold", "item:stat:FlatHPPoolMod". */
export type Change = { field: string; before: Value; after: Value };
export type Kind = "champion" | "item" | "rune";
export type EntityDiff = { kind: Kind; id: string; name: string; status: "changed" | "added" | "removed"; changes: Change[] };

export type RawSpell = { cooldown?: number[]; cost?: number[]; range?: number[] };
export type RawChampion = { id: string; key: string; name: string; stats: Record<string, number>; spells?: RawSpell[] };
export type RawItem = {
  name: string;
  gold: { total: number; purchasable?: boolean };
  stats?: Record<string, number>;
  from?: string[];
  /** Items this one builds into. */
  into?: string[];
  maps?: Record<string, boolean>;
  inStore?: boolean;
};
export type RawRuneStyle = { id: number; name: string; slots: { runes: { id: number; name: string }[] }[] };

const SPELL_KEYS = ["Q", "W", "E", "R"];

/** "6/5.5/5" for per-rank values, one number when every rank is the same. */
export function perRank(values: number[] | undefined): Value {
  if (!values || values.length === 0) return null;
  const rounded = values.map((v) => Math.round(v * 1000) / 1000);
  return rounded.every((v) => v === rounded[0]) ? rounded[0] : rounded.join("/");
}

const LEVEL_STATS: DuelStat[] = ["hp", "attackdamage", "armor", "spellblock", "attackspeed"];
const round = (value: number) => Math.round(value * 1000) / 1000;

function changed(field: string, before: Value, after: Value, out: Change[]) {
  if (before !== after) out.push({ field, before, after });
}

export function diffChampions(before: Record<string, RawChampion>, after: Record<string, RawChampion>): EntityDiff[] {
  const out: EntityDiff[] = [];
  for (const [id, next] of Object.entries(after)) {
    const prev = before[id];
    if (!prev) {
      out.push({ kind: "champion", id: next.key, name: next.name, status: "added", changes: [] });
      continue;
    }
    const changes: Change[] = [];
    for (const stat of new Set([...Object.keys(prev.stats), ...Object.keys(next.stats)])) {
      changed(`stat:${stat}`, prev.stats[stat] ?? null, next.stats[stat] ?? null, changes);
    }
    // The growth number alone says little; show what the stat is at level 18.
    for (const stat of LEVEL_STATS) {
      if (prev.stats[stat] === next.stats[stat] && prev.stats[`${stat}perlevel`] === next.stats[`${stat}perlevel`]) continue;
      changed(`level:${stat}:18`, round(statAt(prev.stats, stat, 18)), round(statAt(next.stats, stat, 18)), changes);
    }
    SPELL_KEYS.forEach((key, i) => {
      const a = prev.spells?.[i];
      const b = next.spells?.[i];
      if (!a || !b) return;
      changed(`spell:${key}:cooldown`, perRank(a.cooldown), perRank(b.cooldown), changes);
      changed(`spell:${key}:cost`, perRank(a.cost), perRank(b.cost), changes);
      changed(`spell:${key}:range`, perRank(a.range), perRank(b.range), changes);
    });
    if (changes.length) out.push({ kind: "champion", id: next.key, name: next.name, status: "changed", changes });
  }
  for (const [id, prev] of Object.entries(before)) {
    if (!after[id]) out.push({ kind: "champion", id: prev.key, name: prev.name, status: "removed", changes: [] });
  }
  return out;
}

/** Items a player can buy on Summoner's Rift; the rest are mode or system items. */
export function onRift(item: RawItem) {
  return item.gold.purchasable !== false && item.inStore !== false && item.maps?.["11"] !== false && item.gold.total > 0;
}

const recipe = (item: RawItem) => (item.from ?? []).slice().sort().join("+") || null;
const buildsInto = (item: RawItem) => (item.into ?? []).slice().sort((a, b) => Number(a) - Number(b)).join("+") || null;

export function diffItems(before: Record<string, RawItem>, after: Record<string, RawItem>): EntityDiff[] {
  const out: EntityDiff[] = [];
  const shop = (items: Record<string, RawItem>) => Object.fromEntries(Object.entries(items).filter(([, item]) => onRift(item)));
  const prevShop = shop(before);
  const nextShop = shop(after);
  for (const [id, next] of Object.entries(nextShop)) {
    const prev = prevShop[id];
    if (!prev) {
      out.push({ kind: "item", id, name: next.name, status: "added", changes: [] });
      continue;
    }
    const changes: Change[] = [];
    changed("item:gold", prev.gold.total, next.gold.total, changes);
    const stats = new Set([...Object.keys(prev.stats ?? {}), ...Object.keys(next.stats ?? {})]);
    for (const stat of stats) changed(`item:stat:${stat}`, prev.stats?.[stat] ?? null, next.stats?.[stat] ?? null, changes);
    changed("item:recipe", recipe(prev), recipe(next), changes);
    changed("item:into", buildsInto(prev), buildsInto(next), changes);
    if (changes.length) out.push({ kind: "item", id, name: next.name, status: "changed", changes });
  }
  for (const [id, prev] of Object.entries(prevShop)) {
    if (!nextShop[id]) out.push({ kind: "item", id, name: prev.name, status: "removed", changes: [] });
  }
  return out;
}

export function diffRunes(before: RawRuneStyle[], after: RawRuneStyle[]): EntityDiff[] {
  const all = (styles: RawRuneStyle[]) => new Map(styles.flatMap((s) => s.slots.flatMap((slot) => slot.runes.map((r) => [r.id, r.name] as const))));
  const prev = all(before);
  const next = all(after);
  const out: EntityDiff[] = [];
  for (const [id, name] of next) if (!prev.has(id)) out.push({ kind: "rune", id: String(id), name, status: "added", changes: [] });
  for (const [id, name] of prev) if (!next.has(id)) out.push({ kind: "rune", id: String(id), name, status: "removed", changes: [] });
  return out;
}

/** Positive when the change helps the champion or item: more stats, lower cooldowns, cost or price. */
export function direction(change: Change): "up" | "down" | null {
  if (typeof change.before !== "number" || typeof change.after !== "number") return null;
  const lowerIsBetter = /:(cooldown|cost)$|^item:gold$/.test(change.field);
  const better = lowerIsBetter ? change.after < change.before : change.after > change.before;
  return change.after === change.before ? null : better ? "up" : "down";
}
