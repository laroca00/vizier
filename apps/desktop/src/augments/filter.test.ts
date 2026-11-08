import { describe, expect, it } from "vitest";
import { classChampions, mergeAugmentStats, tierOf } from "./filter";

describe("mergeAugmentStats", () => {
  const a = { patches: ["16.21"], games: 100, augments: [{ augmentId: 1, games: 50, pickRate: 0.5, winRate: 0.6, tier: "S" }, { augmentId: 2, games: 40, pickRate: 0.4, winRate: 0.4, tier: "D" }] };
  const b = { patches: ["16.21"], games: 300, augments: [{ augmentId: 1, games: 150, pickRate: 0.5, winRate: 0.5, tier: "B" }] };

  it("sums games and weights win rates by them", () => {
    const merged = mergeAugmentStats([a, b]);
    expect(merged.games).toBe(400);
    expect(merged.augments.find((x) => x.augmentId === 1)).toMatchObject({ games: 200, winRate: 0.525, pickRate: 0.5 });
    expect(merged.augments.find((x) => x.augmentId === 2)).toMatchObject({ games: 40, pickRate: 0.1 });
  });

  it("handles an empty list", () => {
    expect(mergeAugmentStats([])).toEqual({ patches: [], games: 0, augments: [] });
  });

  it("orders by tier, then win rate", () => {
    const merged = mergeAugmentStats([a, b]);
    expect(merged.augments.map((x) => x.augmentId)).toEqual([1, 2]);
  });
});

describe("tierOf", () => {
  it("pulls small samples towards even", () => {
    expect(tierOf(8, 10)).not.toBe("S");
    expect(tierOf(1400, 2000)).toBe("S");
    expect(tierOf(800, 2000)).toBe("D");
  });
});

describe("classChampions", () => {
  const tags: Record<number, string[]> = { 1: ["Mage"], 2: ["Mage", "Support"], 3: ["Fighter"], 4: ["Support", "Mage"] };
  it("keeps the main class only, most played first, up to the limit", () => {
    const entries = [1, 2, 3, 4].map((championId) => ({ championId, games: championId * 10 }));
    expect(classChampions(entries, (id) => tags[id], "Mage", 5)).toEqual([2, 1]);
    expect(classChampions(entries, (id) => tags[id], "Mage", 1)).toEqual([2]);
  });
});
