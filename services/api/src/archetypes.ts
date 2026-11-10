// Names builds by what their items do (crit, on-hit, AP...) and enemy teams
// by the damage they deal, from Data Dragon's item stats and champion info.

export type Style = "crit" | "onhit" | "hybrid" | "ap" | "lethality" | "bruiser" | "tank" | "enchanter" | "ad";
/** What an enemy team leans on: magic damage, physical damage, or several tanks. */
export type Foe = "ap" | "ad" | "tank";

export type RawItem = {
  into?: string[];
  tags?: string[];
  consumed?: boolean;
  gold: { total: number };
  stats?: Record<string, number>;
};

export type RawChampion = { key: string; tags: string[]; info: { attack: number; magic: number } };

export type Catalog = {
  /** Items that build into nothing, worth at least 900 gold. */
  finished: Set<number>;
  /** Boots of every tier, to time the first pair. */
  boots: Set<number>;
  styles: Map<number, Style>;
  /** Champions whose damage is mostly magic. */
  magic: Set<number>;
  tanks: Set<number>;
};

export const emptyCatalog = (): Catalog => ({ finished: new Set(), boots: new Set(), styles: new Map(), magic: new Set(), tanks: new Set() });

export const isFinished = (item: RawItem) =>
  !item.into?.length && !item.consumed && !item.tags?.includes("Trinket") && item.gold.total >= 900;

export function itemStyle(item: RawItem): Style | null {
  const stats = item.stats ?? {};
  const tags = new Set(item.tags ?? []);
  // Boots say nothing about the build; Gunmetal Greaves lacks the Boots tag but has flat move speed.
  if (tags.has("Boots") || stats.FlatMovementSpeedMod) return null;
  // Stats miss what an item gives through its passive (Sterak's Gage lists no AD), so tags count too.
  const ap = !!stats.FlatMagicDamageMod || tags.has("SpellDamage");
  const ad = !!stats.FlatPhysicalDamageMod || tags.has("Damage");
  const attackSpeed = !!stats.PercentAttackSpeedMod;
  const health = !!stats.FlatHPPoolMod || !!stats.FlatArmorMod || !!stats.FlatSpellBlockMod;
  if (stats.FlatCritChanceMod) return "crit";
  if (tags.has("ManaRegen") && !tags.has("Lane")) return "enchanter";
  if (ap && (ad || attackSpeed)) return "hybrid";
  if (ap) return "ap";
  if (tags.has("OnHit") && attackSpeed) return "onhit";
  if (tags.has("ArmorPenetration") && ad && !health) return "lethality";
  if (ad && health) return "bruiser";
  if (ad) return "ad";
  if (health) return "tank";
  return null;
}

// Ties go to the more specific style.
const PRIORITY: Style[] = ["crit", "onhit", "hybrid", "ap", "lethality", "bruiser", "enchanter", "tank", "ad"];
const PHYSICAL = new Set<Style>(["crit", "onhit", "lethality", "bruiser", "ad"]);

/** The style of a finished inventory, or null with fewer than two telling items. */
export function buildStyle(items: number[], catalog: Catalog): Style | null {
  const counts = new Map<Style, number>();
  for (const id of new Set(items)) {
    const style = catalog.styles.get(id);
    if (style) counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total < 2) return null;
  const magic = (counts.get("ap") ?? 0) + (counts.get("hybrid") ?? 0);
  const physical = [...PHYSICAL].reduce((sum, s) => sum + (counts.get(s) ?? 0), 0);
  // Nashor's with Kraken Slayer is hybrid even when no single style leads.
  if (counts.has("hybrid") && magic > 0 && physical > 0) return "hybrid";
  let best: Style | null = null;
  for (const style of PRIORITY) if ((counts.get(style) ?? 0) > (best ? counts.get(best)! : 0)) best = style;
  return best && counts.get(best)! >= 2 ? best : null;
}

export function foeProfiles(enemies: number[], catalog: Catalog): Foe[] {
  if (enemies.length !== 5) return [];
  const magic = enemies.filter((id) => catalog.magic.has(id)).length;
  const tanks = enemies.filter((id) => catalog.tanks.has(id)).length;
  const foes: Foe[] = [];
  if (magic >= 3) foes.push("ap");
  if (magic <= 1) foes.push("ad");
  if (tanks >= 2) foes.push("tank");
  return foes;
}

export function catalogFrom(items: Record<string, RawItem>, champions: Record<string, RawChampion>): Catalog {
  const catalog = emptyCatalog();
  for (const [id, item] of Object.entries(items)) {
    if (item.tags?.includes("Boots")) catalog.boots.add(Number(id));
    if (!isFinished(item)) continue;
    catalog.finished.add(Number(id));
    const style = itemStyle(item);
    if (style) catalog.styles.set(Number(id), style);
  }
  for (const champion of Object.values(champions)) {
    const id = Number(champion.key);
    if (champion.info.magic > champion.info.attack) catalog.magic.add(id);
    if (champion.tags[0] === "Tank") catalog.tanks.add(id);
  }
  return catalog;
}
