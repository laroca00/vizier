import type { BuildIndexEntry } from "./api";
import type { ItemDetail } from "./data/ddragon";
import { goldEfficiency, STAT_PRICES } from "./data/itemGold";

export type ItemSort = "name" | "price" | "efficiency";
export type ItemFilter = { query: string; stat: string | null; minPrice: number; maxPrice: number };

export const NO_FILTER: ItemFilter = { query: "", stat: null, minPrice: 0, maxPrice: Infinity };

/** Finished, purchasable items; components and consumables are reachable through recipes. */
export const explorable = (item: ItemDetail) => item.complete && item.gold.purchasable;

/** The stats the filter offers: those some finished item has. */
export function offeredStats(items: ItemDetail[]): string[] {
  const found = new Set<string>();
  for (const item of items) for (const key of Object.keys(item.stats)) if (STAT_PRICES[key] && item.stats[key]) found.add(key);
  return Object.keys(STAT_PRICES).filter((key) => found.has(key));
}

export function filterItems(items: ItemDetail[], filter: ItemFilter, locale: string): ItemDetail[] {
  const q = filter.query.trim().toLocaleLowerCase(locale);
  return items.filter(
    (item) =>
      (!q || item.name.toLocaleLowerCase(locale).includes(q)) &&
      (!filter.stat || !!item.stats[filter.stat]) &&
      item.gold.total >= filter.minPrice &&
      item.gold.total <= filter.maxPrice,
  );
}

export function sortItems(items: ItemDetail[], sort: ItemSort, locale: string): ItemDetail[] {
  const eff = (item: ItemDetail) => goldEfficiency(item.stats, item.gold.total) ?? -1;
  return [...items].sort((a, b) =>
    sort === "price" ? a.gold.total - b.gold.total || a.name.localeCompare(b.name, locale) : sort === "efficiency" ? eff(b) - eff(a) : a.name.localeCompare(b.name, locale),
  );
}


/**
 * Champion builds whose item list includes the item, most played first. The
 * index lists core items and the most bought finished ones, so this means
 * "builds it", not "builds it every game".
 */
export function buildersOf(itemId: number, index: BuildIndexEntry[], limit: number): BuildIndexEntry[] {
  return index
    .filter((b) => b.items.includes(itemId))
    .sort((a, b) => b.games - a.games)
    .slice(0, limit);
}
