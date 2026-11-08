import { describe, expect, it } from "vitest";
import { diffChampions, diffItems, diffRunes, direction, perRank, verdict, type RawChampion, type RawItem } from "./diff";

const ahri = (hp: number, qCooldown: number[]): RawChampion => ({
  id: "Ahri",
  key: "103",
  name: "Ahri",
  stats: { hp, armor: 21 },
  spells: [{ cooldown: qCooldown, cost: [55, 65], range: [880] }, {}, {}, {}],
});

describe("patch diff", () => {
  it("finds stat and ability changes, and new or removed champions", () => {
    const before = { Ahri: ahri(590, [7, 7]), Old: { id: "Old", key: "1", name: "Old", stats: {} } };
    const after = { Ahri: ahri(600, [7, 6.5]), New: { id: "New", key: "2", name: "New", stats: {} } };
    const diff = diffChampions(before, after);
    const ahriDiff = diff.find((d) => d.id === "103")!;
    expect(ahriDiff.changes).toEqual([
      { field: "stat:hp", before: 590, after: 600 },
      { field: "level:hp:18", before: 590, after: 600 },
      { field: "spell:Q:cooldown", before: 7, after: "7/6.5" },
    ]);
    expect(diff.find((d) => d.id === "2")?.status).toBe("added");
    expect(diff.find((d) => d.id === "1")?.status).toBe("removed");
  });

  it("adds the level 18 value when a growth number changes", () => {
    const champ = (growth: number): RawChampion => ({ id: "A", key: "1", name: "A", stats: { hp: 600, hpperlevel: growth, armor: 30 } });
    const [diff] = diffChampions({ A: champ(100) }, { A: champ(110) });
    const level18 = (growth: number) => Math.round((600 + growth * 17 * (0.7025 + 0.0175 * 17)) * 1000) / 1000;
    expect(diff.changes).toContainEqual({ field: "level:hp:18", before: level18(100), after: level18(110) });
    expect(diff.changes.some((c) => c.field.startsWith("level:armor"))).toBe(false);
  });

  it("leaves unchanged champions out", () => {
    expect(diffChampions({ Ahri: ahri(590, [7]) }, { Ahri: ahri(590, [7]) })).toEqual([]);
  });

  it("compares Rift shop items by price, stats and recipe", () => {
    const item = (total: number, ad: number, from: string[]): RawItem => ({ name: "Blade", gold: { total, purchasable: true }, stats: { FlatPhysicalDamageMod: ad }, from, maps: { "11": true } });
    const arena: RawItem = { name: "Arena only", gold: { total: 3000 }, maps: { "11": false } };
    const diff = diffItems({ "1": item(3000, 40, ["a", "b"]), "9": arena }, { "1": item(3100, 45, ["b", "c"]), "9": arena });
    expect(diff).toHaveLength(1);
    expect(diff[0].changes.map((c) => c.field)).toEqual(["item:gold", "item:stat:FlatPhysicalDamageMod", "item:recipe"]);
  });

  it("notices when an item builds into something else", () => {
    const item = (into: string[]): RawItem => ({ name: "Part", gold: { total: 800, purchasable: true }, into, maps: { "11": true } });
    const [diff] = diffItems({ "1": item(["5", "7"]) }, { "1": item(["7", "9"]) });
    expect(diff.changes).toEqual([{ field: "item:into", before: "5+7", after: "7+9" }]);
  });

  it("writes cooldown and cost changes for every rank", () => {
    const champ = (cooldown: number[], cost: number[]): RawChampion => ({ id: "A", key: "1", name: "A", stats: {}, spells: [{ cooldown, cost }, {}, {}, {}] });
    const [diff] = diffChampions({ A: champ([10, 9, 8, 7, 6], [50, 50, 50, 50, 50]) }, { A: champ([10, 9, 8, 7, 5], [50, 55, 60, 65, 70]) });
    expect(diff.changes).toEqual([
      { field: "spell:Q:cooldown", before: "10/9/8/7/6", after: "10/9/8/7/5" },
      { field: "spell:Q:cost", before: 50, after: "50/55/60/65/70" },
    ]);
  });

  it("lists runes added and removed", () => {
    const style = (ids: number[]) => [{ id: 8000, name: "P", slots: [{ runes: ids.map((id) => ({ id, name: `r${id}` })) }] }];
    expect(diffRunes(style([1, 2]), style([2, 3])).map((d) => [d.id, d.status])).toEqual([
      ["3", "added"],
      ["1", "removed"],
    ]);
  });

  it("reads per-rank values and which way a change goes", () => {
    expect(perRank([5, 5, 5])).toBe(5);
    expect(perRank([10, 9.5])).toBe("10/9.5");
    expect(direction({ field: "spell:Q:cooldown", before: 7, after: 6 })).toBe("up");
    expect(direction({ field: "item:gold", before: 3000, after: 3100 })).toBe("down");
    expect(direction({ field: "stat:hp", before: 590, after: 600 })).toBe("up");
    expect(direction({ field: "spell:Q:cooldown", before: "7/6", after: 6 })).toBeNull();
  });
});

describe("verdict", () => {
  const entry = (changes: [string, number | string, number | string][]) => ({
    kind: "champion" as const, id: "1", name: "A", status: "changed" as const,
    changes: changes.map(([field, before, after]) => ({ field, before, after })),
  });

  it("calls an all-helpful patch a buff and an all-harmful one a nerf", () => {
    expect(verdict(entry([["stat:hp", 600, 610], ["spell:Q:cooldown", 8, 7]]))).toBe("buff");
    expect(verdict(entry([["stat:armor", 30, 28], ["spell:Q:cost", 50, 60]]))).toBe("nerf");
  });

  it("calls a mix of both mixed", () => {
    expect(verdict(entry([["stat:hp", 600, 610], ["stat:armor", 30, 28]]))).toBe("mixed");
  });

  it("reads per-rank values only when every rank moves the same way", () => {
    expect(direction({ field: "spell:Q:cooldown", before: "10/9/8", after: "9/8/7" })).toBe("up");
    expect(direction({ field: "spell:Q:cooldown", before: "10/9/8", after: "9/9/9" })).toBeNull();
  });

  it("has no verdict for new champions or changes without a direction", () => {
    expect(verdict({ ...entry([]), status: "added" })).toBeNull();
    expect(verdict(entry([["item:recipe", "1+2", "1+3"]]))).toBeNull();
  });

  it("does not count the level 18 line twice", () => {
    expect(verdict(entry([["stat:hp", 600, 610], ["level:hp:18", 1000, 1010], ["stat:armor", 30, 28]]))).toBe("mixed");
  });
});
