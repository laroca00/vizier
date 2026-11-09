import type { Build } from "../api";
import type { ItemDetail } from "../data/ddragon";
import { fromPicks } from "../library/convert";
import type { LabColumn } from "./columns";

// A build direction is a rule over the tags and stats Data Dragon gives an
// item, applied to the items the champion's builds already use. The rules are
// hand-kept and say so; only "anti-tank" can lean on crawler data.

export type DirectionId = "standard" | "burst" | "anti-tank" | "sustain" | "defensive" | "hybrid" | "poke" | "utility";

export const DIRECTIONS: { id: DirectionId; label: string; blurb: string }[] = [
  { id: "standard", label: "Standart", blurb: "Şampiyonun en çok oynanan build'i." },
  { id: "burst", label: "Patlama", blurb: "Hasar ve delme: kısa sürede çok vurmak için." },
  { id: "anti-tank", label: "Tanka karşı", blurb: "Zırh ve büyü delme, vuruşla gelen etkiler." },
  { id: "sustain", label: "Dayanıklılık", blurb: "Can çalma ve yenilenme." },
  { id: "defensive", label: "Savunma", blurb: "Zırh, büyü direnci ve can." },
  { id: "hybrid", label: "Karma", blurb: "Hem hasar hem dayanıklılık veren eşyalar." },
  { id: "poke", label: "Dürtme", blurb: "Mana ve bekleme süresiyle uzaktan sürekli hasar." },
  { id: "utility", label: "Yardımcı etkiler", blurb: "Hareket, aura ve kullanılabilir etkiler." },
];

export const SHOWN_DIRECTION_ITEMS = 6;
/** Fewer matching items than this and the direction doesn't fit the champion; no column is drawn. */
export const MIN_DIRECTION_ITEMS = 2;

type Rated = Pick<ItemDetail, "tags" | "stats">;

const has = (item: Rated, ...tags: string[]) => tags.some((tag) => item.tags.includes(tag));
const stat = (item: Rated, key: string) => (item.stats[key] ?? 0) > 0;

const damage = (item: Rated) => has(item, "Damage", "SpellDamage") || stat(item, "FlatPhysicalDamageMod") || stat(item, "FlatMagicDamageMod");
const tough = (item: Rated) => has(item, "Armor", "SpellBlock", "Health") || stat(item, "FlatArmorMod") || stat(item, "FlatSpellBlockMod") || stat(item, "FlatHPPoolMod");

/** Whether an item suits a direction. Pure, so the rules are tested one by one. */
export function suits(direction: DirectionId, item: Rated): boolean {
  switch (direction) {
    case "standard":
      return true;
    case "burst":
      return damage(item) && has(item, "ArmorPenetration", "MagicPenetration", "AbilityHaste", "CooldownReduction") && !has(item, "AttackSpeed", "CriticalStrike");
    case "anti-tank":
      return has(item, "ArmorPenetration", "MagicPenetration", "OnHit");
    case "sustain":
      return has(item, "LifeSteal", "SpellVamp", "HealthRegen") || stat(item, "FlatHPRegenMod");
    case "defensive":
      return has(item, "Armor", "SpellBlock") || stat(item, "FlatArmorMod") || stat(item, "FlatSpellBlockMod") || (has(item, "Health") && !damage(item));
    case "hybrid":
      return damage(item) && tough(item);
    case "poke":
      return damage(item) && has(item, "Mana", "ManaRegen", "AbilityHaste", "CooldownReduction");
    case "utility":
      return has(item, "Aura", "Active", "Slow", "NonbootsMovement", "Tenacity", "Vision", "ManaRegen") && !has(item, "Boots");
  }
}

/** Finished items the champion's builds use, with the most games any build gave them. */
export function itemPool(build: Build, usable: (id: number) => boolean): { id: number; games: number }[] {
  const games = new Map<number, number>();
  const add = (id: number, n: number) => games.set(id, Math.max(games.get(id) ?? 0, n));
  for (const i of build.items) add(i.id, i.games);
  for (const v of build.variants ?? []) for (const i of v.items) add(i.id, i.games);
  for (const group of build.situational ?? []) for (const i of group.items) add(i.id, i.games);
  return [...games].filter(([id]) => usable(id)).map(([id, n]) => ({ id, games: n })).sort((a, b) => b.games - a.games);
}

/**
 * The extra column for a direction, or null when too few items fit. "Tanka karşı"
 * uses what players bought against tank teams when there are such games.
 */
export function directionColumn(
  direction: DirectionId,
  build: Build,
  details: Map<number, Pick<ItemDetail, "tags" | "stats" | "complete" | "gold">>,
  championId: number,
  position: string | null,
): LabColumn | null {
  const meta = DIRECTIONS.find((d) => d.id === direction);
  if (!meta || direction === "standard") return null;
  const usable = (id: number) => !!details.get(id)?.complete && !!details.get(id)?.gold.purchasable;
  const base = fromPicks({ name: "", championId, position }, build, usable);

  let ids: number[];
  let basis: LabColumn["basis"] = "editorial";
  let games: number | undefined;
  const group = direction === "anti-tank" ? build.situational?.find((g) => g.vs === "tank") : undefined;
  const fromData = group ? group.items.map((i) => i.id).filter(usable) : [];
  if (group && fromData.length >= MIN_DIRECTION_ITEMS) {
    ids = fromData;
    basis = "data";
    games = group.games;
  } else {
    ids = itemPool(build, usable).map((i) => i.id).filter((id) => suits(direction, details.get(id)!));
  }
  ids = ids.slice(0, SHOWN_DIRECTION_ITEMS);
  if (ids.length < MIN_DIRECTION_ITEMS) return null;
  return {
    id: "direction",
    label: "Yön",
    build: { ...base, startItems: [], coreItems: ids.slice(0, 3), items: ids.slice(3) },
    sample: null,
    basis,
    games,
    style: meta.label,
  };
}
