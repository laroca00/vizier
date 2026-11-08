import { describe, expect, it } from "vitest";
import type { TierEntry } from "../api";
import { DEFAULT_TIER_VIEW, isThin, sortTiers, viewTiers, withoutThin } from "./tierSort";

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

describe("viewTiers", () => {
  const names: Record<number, string> = { 1: "Ahri", 2: "Zed", 3: "Işın", 4: "Lux" };
  const nameOf = (id: number) => names[id];
  const view = (change: Partial<typeof DEFAULT_TIER_VIEW>) => ({ ...DEFAULT_TIER_VIEW, ...change });
  const ids = (rows: TierEntry[]) => rows.map((r) => r.championId);

  it("searches by name without caring for case or accents", () => {
    expect(ids(viewTiers(list, view({ query: "ISIN" }), nameOf, new Set()))).toEqual([3]);
    expect(ids(viewTiers(list, view({ query: "lu" }), nameOf, new Set()))).toEqual([4]);
  });
  it("shows only the pool on request", () => {
    expect(ids(viewTiers(list, view({ poolOnly: true }), nameOf, new Set([2, 4])))).toEqual([2, 4]);
  });
  it("sorts a column both ways and puts empty values last", () => {
    const withChange = [{ ...list[0], winRateChange: 0.01 }, { ...list[1], winRateChange: null }, { ...list[2], winRateChange: -0.02 }, { ...list[3], winRateChange: 0.03 }];
    expect(ids(viewTiers(withChange, view({ sort: "change" }), nameOf, new Set()))).toEqual([4, 1, 3, 2]);
    expect(ids(viewTiers(withChange, view({ sort: "change", desc: false }), nameOf, new Set()))).toEqual([3, 1, 4, 2]);
  });
  it("sorts by name and keeps thin rows last on rate columns", () => {
    expect(ids(viewTiers(list, view({ sort: "name", desc: false }), nameOf, new Set()))).toEqual([1, 3, 4, 2]);
    expect(ids(viewTiers(list, view({ sort: "winRate" }), nameOf, new Set()))).toEqual([3, 4, 1, 2]);
  });
  it("reverses the server order for tier ascending", () => {
    expect(ids(viewTiers(list, view({ desc: false }), nameOf, new Set()))).toEqual([4, 3, 2, 1]);
  });
});
