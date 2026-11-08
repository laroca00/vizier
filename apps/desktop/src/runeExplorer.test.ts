import { describe, expect, it } from "vitest";
import type { BuildIndexEntry } from "./api";
import { summarizeKeystones } from "./runeExplorer";

const build = (championId: number, keystone: number | null, games: number, winRate: number): BuildIndexEntry => ({ championId, position: "MIDDLE", games, winRate, keystone, styles: [], items: [] });

describe("keystone summary", () => {
  const summary = summarizeKeystones([build(1, 8112, 100, 0.5), build(2, 8112, 300, 0.54), build(3, 8229, 50, 0.6), build(4, null, 999, 0.9), build(5, 8229, 0, 0.9)]);

  it("weights the win rate by games", () => {
    expect(summary.get(8112)?.games).toBe(400);
    expect(summary.get(8112)?.winRate).toBeCloseTo(0.53, 5);
  });

  it("orders champions by games and skips builds without a keystone or games", () => {
    expect(summary.get(8112)?.builds.map((b) => b.championId)).toEqual([2, 1]);
    expect(summary.get(8229)?.builds).toHaveLength(1);
    expect(summary.size).toBe(2);
  });
});
