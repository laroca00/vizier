import { describe, expect, it } from "vitest";
import type { Build, Choice } from "../api";
import { directionColumn, itemPool, suits } from "./directions";

const item = (tags: string[], stats: Record<string, number> = {}) => ({ tags, stats });
const detail = (id: number, tags: string[], stats: Record<string, number> = {}) => [id, { tags, stats, complete: true, gold: { base: 0, total: 3000, purchasable: true } }] as const;
const pick = (id: number, games: number): Choice<{ id: number }> => ({ id, games, winRate: 0.5 });

describe("suits", () => {
  it("burst wants damage with penetration or haste and no attack speed", () => {
    expect(suits("burst", item(["SpellDamage", "MagicPenetration"]))).toBe(true);
    expect(suits("burst", item(["Damage", "AttackSpeed", "ArmorPenetration"]))).toBe(false);
    expect(suits("burst", item(["Armor"]))).toBe(false);
  });
  it("defensive takes armor, magic resist and plain health", () => {
    expect(suits("defensive", item(["Armor"]))).toBe(true);
    expect(suits("defensive", item([], { FlatSpellBlockMod: 40 }))).toBe(true);
    expect(suits("defensive", item(["Health", "Damage"]))).toBe(false);
  });
  it("hybrid needs both damage and toughness", () => {
    expect(suits("hybrid", item(["Damage", "Health"]))).toBe(true);
    expect(suits("hybrid", item(["Damage"]))).toBe(false);
  });
  it("sustain, poke, utility and anti-tank read their tags", () => {
    expect(suits("sustain", item(["LifeSteal"]))).toBe(true);
    expect(suits("poke", item(["SpellDamage", "ManaRegen"]))).toBe(true);
    expect(suits("utility", item(["Aura"]))).toBe(true);
    expect(suits("utility", item(["Boots", "Active"]))).toBe(false);
    expect(suits("anti-tank", item(["MagicPenetration"]))).toBe(true);
    expect(suits("standard", item([]))).toBe(true);
  });
});

const build = {
  items: [pick(1, 500), pick(2, 300), pick(3, 100)],
  variants: [{ items: [pick(4, 900), pick(1, 50)] }],
  situational: [{ vs: "tank", games: 400, items: [pick(5, 200), pick(6, 150)] }],
  runes: [], spells: [], startItems: null, coreItems: null, skills: null, patches: ["16.21"], games: 1000, winRate: 0.5, vs: null,
} as unknown as Build;

describe("itemPool", () => {
  it("merges the builds' items by their best game count, most played first", () => {
    expect(itemPool(build, () => true).map((i) => [i.id, i.games])).toEqual([[4, 900], [1, 500], [2, 300], [5, 200], [6, 150], [3, 100]]);
  });
});

describe("directionColumn", () => {
  const details = new Map([detail(1, ["Armor"]), detail(2, ["SpellBlock"]), detail(3, ["Health"]), detail(4, ["Damage"]), detail(5, ["ArmorPenetration"]), detail(6, ["OnHit"])]);
  it("is null for the standard direction", () => {
    expect(directionColumn("standard", build, details, 1, "MIDDLE")).toBeNull();
  });
  it("is labelled editorial and keeps the pool's order", () => {
    const column = directionColumn("defensive", build, details, 1, "MIDDLE")!;
    expect(column.basis).toBe("editorial");
    expect([...column.build.coreItems, ...column.build.items]).toEqual([1, 2, 3]);
  });
  it("uses what was bought against tank teams when there are games", () => {
    const column = directionColumn("anti-tank", build, details, 1, "MIDDLE")!;
    expect(column.basis).toBe("data");
    expect(column.games).toBe(400);
    expect(column.build.coreItems).toEqual([5, 6]);
  });
  it("draws nothing when fewer than two items fit", () => {
    expect(directionColumn("sustain", build, details, 1, "MIDDLE")).toBeNull();
  });
});
