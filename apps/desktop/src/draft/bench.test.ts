import { describe, expect, it } from "vitest";
import type { TierEntry } from "../api";
import { rankBench, rerollAdvice } from "./bench";

const entry = (championId: number, winRate: number, games = 1000): TierEntry => ({ championId, games, winRate, pickRate: 0.02, tier: "A", winRateChange: null });

describe("rankBench", () => {
  const tierList = [entry(1, 0.5), entry(2, 0.55), entry(3, 0.48), entry(4, 0.57, 20)];

  it("sorts by win rate and marks the bench champion that beats the current one", () => {
    const rows = rankBench({ tierList, current: 1, bench: [2, 3], allies: [] });
    expect(rows.map((r) => r.championId)).toEqual([2, 1, 3]);
    expect(rows.find((r) => r.championId === 2)?.take).toBe(true);
    expect(rows.find((r) => r.championId === 3)?.take).toBe(false);
  });

  it("does not mark a small lead or a thin sample", () => {
    expect(rankBench({ tierList: [entry(1, 0.5), entry(2, 0.51)], current: 1, bench: [2], allies: [] }).some((r) => r.take)).toBe(false);
    const rows = rankBench({ tierList, current: 1, bench: [4], allies: [] });
    expect(rows.find((r) => r.championId === 4)).toMatchObject({ winRate: null, games: 20, take: false });
  });

  it("lists allies once and keeps their source", () => {
    const rows = rankBench({ tierList, current: 1, bench: [2], allies: [2, 3, 0] });
    expect(rows.map((r) => [r.championId, r.source])).toEqual([[2, "bench"], [1, "current"], [3, "ally"]]);
  });
});

describe("rerollAdvice", () => {
  const list = Array.from({ length: 40 }, (_, i) => entry(i + 1, 0.56 - i * 0.003));

  it("suggests a reroll for a champion near the bottom", () => {
    const advice = rerollAdvice(list, 39, 1);
    expect(advice).toMatchObject({ rank: 39, total: 40, games: 1000 });
  });

  it("stays quiet without rerolls, for good champions and for thin lists", () => {
    expect(rerollAdvice(list, 39, 0)).toBeNull();
    expect(rerollAdvice(list, 2, 2)).toBeNull();
    expect(rerollAdvice(list, 25, 2)).toBeNull();
    expect(rerollAdvice(list.slice(0, 10), 9, 2)).toBeNull();
    expect(rerollAdvice(list, 99, 2)).toBeNull();
  });

  it("ignores a champion with too few games", () => {
    expect(rerollAdvice([...list.slice(0, 39), entry(40, 0.4, 10)], 40, 1)).toBeNull();
  });
});
