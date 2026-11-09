import { describe, expect, it } from "vitest";
import { barShare, runningTotals, shownStats, statValue, sumStats } from "./totals";

const details = new Map<number, { stats: Record<string, number> }>([
  [1, { stats: { FlatMagicDamageMod: 80, FlatHPPoolMod: 300 } }],
  [2, { stats: { FlatMagicDamageMod: 60, PercentAttackSpeedMod: 0.25, SomethingElse: 9 } }],
  [3, { stats: {} }],
]);

describe("sumStats", () => {
  it("adds known stats and ignores the rest", () => {
    expect(sumStats([1, 2, 3, 99], details)).toEqual({ FlatMagicDamageMod: 140, FlatHPPoolMod: 300, PercentAttackSpeedMod: 0.25 });
  });
  it("gives totals after each item", () => {
    expect(runningTotals([1, 2], details).map((t) => t.FlatMagicDamageMod)).toEqual([80, 140]);
  });
});

describe("display", () => {
  it("lists only stats some column has, in a fixed order", () => {
    expect(shownStats([sumStats([1], details), sumStats([2], details)])).toEqual(["FlatMagicDamageMod", "FlatHPPoolMod", "PercentAttackSpeedMod"]);
  });
  it("shows percent stats as points", () => {
    expect(statValue("PercentAttackSpeedMod", 0.25)).toBe(25);
    expect(statValue("FlatHPPoolMod", 300)).toBe(300);
  });
  it("scales bars to the biggest column", () => {
    const cols = [sumStats([1], details), sumStats([1, 2], details)];
    expect([barShare(cols, "FlatMagicDamageMod", 0), barShare(cols, "FlatMagicDamageMod", 1)]).toEqual([57, 100]);
  });
});
