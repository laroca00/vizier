import { describe, expect, it } from "vitest";
import type { BuildIndexEntry } from "./api";
import type { ItemDetail } from "./data/ddragon";
import { buildersOf, explorable, filterItems, NO_FILTER, offeredStats, sortItems } from "./itemExplorer";

const item = (id: number, name: string, total: number, stats: Record<string, number>, extra: Partial<ItemDetail> = {}): ItemDetail => ({
  id, name, plaintext: "", gold: { base: 0, total, purchasable: true }, from: [], into: [], stats, tags: [], complete: true, ...extra,
});
const bf = item(3031, "Infinity Edge", 3400, { FlatPhysicalDamageMod: 65, FlatCritChanceMod: 0.25 });
const rabadon = item(3089, "Rabadon's Deathcap", 3600, { FlatMagicDamageMod: 130 });
const randuin = item(3143, "Randuin's Omen", 2700, { FlatArmorMod: 80, FlatHPPoolMod: 350 });
const all = [bf, rabadon, randuin];

describe("item explorer", () => {
  it("lists only finished purchasable items", () => {
    expect([item(1, "Dagger", 300, {}, { complete: false }), item(2, "Event", 1000, {}, { gold: { base: 0, total: 1000, purchasable: false } }), bf].filter(explorable)).toEqual([bf]);
  });

  it("filters by name, stat and price together", () => {
    expect(filterItems(all, { ...NO_FILTER, query: "ra" }, "en").map((i) => i.id)).toEqual([3089, 3143]);
    expect(filterItems(all, { ...NO_FILTER, stat: "FlatArmorMod" }, "en").map((i) => i.id)).toEqual([3143]);
    expect(filterItems(all, { ...NO_FILTER, minPrice: 3000, maxPrice: 3500 }, "en").map((i) => i.id)).toEqual([3031]);
  });

  it("offers the stats finished items have, in the table's order", () => {
    expect(offeredStats(all)).toEqual(["FlatPhysicalDamageMod", "FlatMagicDamageMod", "FlatArmorMod", "FlatHPPoolMod", "FlatCritChanceMod"]);
  });

  it("sorts by price and by gold efficiency", () => {
    expect(sortItems(all, "price", "en").map((i) => i.id)).toEqual([3143, 3031, 3089]);
    expect(sortItems(all, "efficiency", "en").map((i) => i.id)).toEqual([3031, 3143, 3089]);
    expect(sortItems(all, "name", "en")[0].id).toBe(3031);
  });

  it("finds the most played builds that include an item", () => {
    const entry = (championId: number, games: number, items: number[]): BuildIndexEntry => ({ championId, position: "MIDDLE", games, winRate: 0.5, keystone: null, styles: [], items });
    const index = [entry(1, 100, [3089]), entry(2, 900, [3089, 3031]), entry(3, 500, [3143])];
    expect(buildersOf(3089, index, 5).map((b) => b.championId)).toEqual([2, 1]);
    expect(buildersOf(3089, index, 1)).toHaveLength(1);
  });
});
