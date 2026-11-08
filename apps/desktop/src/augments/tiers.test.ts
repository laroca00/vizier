import { describe, expect, it } from "vitest";
import type { AugmentStat } from "../api";
import { augmentQueue, augmentsByRarity, formatDelta, sortAugments, tierRows } from "./tiers";

const stat = (augmentId: number, tier: string, winRate: number, games = 100, pickRate = 0.1): AugmentStat => ({ augmentId, tier, winRate, games, pickRate, delta: 0 });

describe("tierRows", () => {
  it("groups by tier, best win rate first, and drops empty tiers", () => {
    const rows = tierRows([stat(1, "B", 0.5), stat(2, "S", 0.55), stat(3, "S", 0.6), stat(4, "D", 0.4)]);
    expect(rows.map((r) => r.tier)).toEqual(["S", "B", "D"]);
    expect(rows[0].augments.map((a) => a.augmentId)).toEqual([3, 2]);
  });

  it("applies the filter before dropping tiers", () => {
    expect(tierRows([stat(1, "S", 0.6), stat(2, "A", 0.55)], (a) => a.augmentId === 2).map((r) => r.tier)).toEqual(["A"]);
  });
});

describe("sortAugments", () => {
  const rows = [stat(1, "B", 0.5, 300, 0.3), stat(2, "S", 0.55, 100, 0.1), stat(3, "A", 0.52, 200, 0.2)];
  const names: Record<number, string> = { 1: "Çelik", 2: "Arılar", 3: "Buz" };
  const sorted = (column: Parameters<typeof sortAugments>[1], desc: boolean) => sortAugments(rows, column, desc, (id) => names[id], "tr").map((a) => a.augmentId);

  it("puts the best tier first when descending", () => expect(sorted("tier", true)).toEqual([2, 3, 1]));
  it("sorts by games and pick rate", () => {
    expect(sorted("games", true)).toEqual([1, 3, 2]);
    expect(sorted("pick", false)).toEqual([2, 3, 1]);
  });
  it("sorts names in the interface language", () => expect(sorted("name", false)).toEqual([2, 3, 1]));
});

describe("formatDelta", () => {
  it("signs percentage points", () => {
    expect(formatDelta(0.042, "en")).toBe("+4.2");
    expect(formatDelta(-0.01, "tr")).toBe("−1,0");
    expect(formatDelta(0, "en")).toBe("±0.0");
    expect(formatDelta(undefined, "en")).toBeNull();
  });
});

describe("in-game augments", () => {
  it("reads the queue from the live game mode", () => {
    expect(augmentQueue("CHERRY")).toBe(1700);
    expect(augmentQueue("KIWI")).toBe(2400);
    expect(augmentQueue("ARAM")).toBeNull();
  });

  it("keeps the best few of each rarity, prismatic first", () => {
    const rarity: Record<number, number> = { 1: 0, 2: 0, 3: 2, 4: 0, 5: 1 };
    const groups = augmentsByRarity([stat(1, "B", 0.5), stat(2, "S", 0.6), stat(3, "A", 0.55), stat(4, "S", 0.58), stat(5, "D", 0.4)], (id) => rarity[id], 2);
    expect(groups.map((g) => g.rarity)).toEqual([2, 1, 0]);
    expect(groups[2].augments.map((a) => a.augmentId)).toEqual([2, 4]);
  });
});
