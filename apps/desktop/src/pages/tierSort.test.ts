import { describe, expect, it } from "vitest";
import type { TierEntry } from "../api";
import { isThin, sortTiers, withoutThin } from "./tierSort";

const row = (championId: number, winRate: number, pickRate: number, games = 1000): TierEntry => ({ championId, winRate, pickRate, games, tier: "A", winRateChange: null });
const list = [row(1, 0.5, 0.1), row(2, 0.56, 0.02, 30), row(3, 0.53, 0.05), row(4, 0.51, 0.2)];

describe("sortTiers", () => {
  it("keeps the server order for tier", () => {
    expect(sortTiers(list, "tier")).toBe(list);
  });

  it("sorts by win rate with thin samples last", () => {
    expect(sortTiers(list, "winRate").map((r) => r.championId)).toEqual([3, 4, 1, 2]);
  });

  it("sorts by pick rate and leaves the input alone", () => {
    expect(sortTiers(list, "pickRate").map((r) => r.championId)).toEqual([4, 1, 3, 2]);
    expect(list.map((r) => r.championId)).toEqual([1, 2, 3, 4]);
  });

  it("flags rows under 100 games and can hide them", () => {
    expect(isThin(row(1, 0.5, 0.1, 99))).toBe(true);
    expect(isThin(row(1, 0.5, 0.1, 100))).toBe(false);
    expect(withoutThin(list, true).map((r) => r.championId)).toEqual([1, 3, 4]);
    expect(withoutThin(list, false)).toBe(list);
  });
});
