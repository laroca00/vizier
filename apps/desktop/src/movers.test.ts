import { describe, expect, it } from "vitest";
import type { TierEntry } from "./api";
import { metaMovers } from "./movers";

const row = (championId: number, games: number, winRateChange: number | null, pickRateChange?: number | null): TierEntry => ({
  championId, games, winRate: 0.5, pickRate: 0.1, tier: "B", winRateChange, pickRateChange,
});

describe("metaMovers", () => {
  const roles = [
    { position: "TOP", champions: [row(1, 500, 0.03, 0.02), row(2, 500, -0.04, -0.01), row(3, 50, 0.09, 0.2), row(4, 400, 0.001, 0)] },
    { position: "MIDDLE", champions: [row(5, 900, 0.02, -0.03), row(6, 300, null, null), row(1, 700, -0.01, 0.01)] },
  ];

  it("ranks win rate risers and fallers across roles", () => {
    const m = metaMovers(roles);
    expect(m.winRateUp.map((r) => [r.championId, r.position])).toEqual([[1, "TOP"], [5, "MIDDLE"]]);
    expect(m.winRateDown.map((r) => r.championId)).toEqual([2, 1]);
  });
  it("ignores thin samples, tiny moves and missing changes", () => {
    const ids = metaMovers(roles).winRateUp.map((r) => r.championId);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(6);
  });
  it("ranks pick rate and tolerates servers without it", () => {
    const m = metaMovers(roles);
    expect(m.pickRateUp.map((r) => [r.championId, r.position])).toEqual([[1, "TOP"], [1, "MIDDLE"]]);
    expect(m.pickRateDown.map((r) => r.championId)).toEqual([5, 2]);
    const old = metaMovers([{ position: "TOP", champions: [row(1, 500, 0.03)] }]);
    expect(old.pickRateUp).toEqual([]);
  });
});
