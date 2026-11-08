import { describe, expect, it } from "vitest";
import { hasRankData, rankRows } from "./abilityRanks";
import type { Ability } from "./ddragon";

const base: Ability = { key: "Q", name: "Q", description: "", image: "", cooldowns: [7, 6, 5], costs: [50, 55, 60], ranges: [880, 880, 880] };

describe("rankRows", () => {
  it("reads cooldown, cost and range per rank", () => {
    expect(rankRows(base)[1]).toEqual({ rank: 2, cooldown: 6, cost: 55, range: 880 });
    expect(rankRows(base)).toHaveLength(3);
  });
  it("uses null for no cost, no cooldown and the no-range marker", () => {
    const rows = rankRows({ ...base, cooldowns: [0, 0], costs: [0, 0], ranges: [25000, 25000] });
    expect(rows[0]).toEqual({ rank: 1, cooldown: null, cost: null, range: null });
    expect(hasRankData(rows)).toBe(false);
  });
  it("copes with missing arrays", () => {
    const rows = rankRows({ ...base, costs: undefined, ranges: undefined });
    expect(rows[0]).toEqual({ rank: 1, cooldown: 7, cost: null, range: null });
    expect(rankRows({ ...base, cooldowns: [], costs: undefined, ranges: undefined })).toEqual([]);
  });
});
