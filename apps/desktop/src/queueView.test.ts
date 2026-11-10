import { describe, expect, it } from "vitest";
import type { TierEntry } from "./api";
import { autofillPicks, queuePool } from "./queueView";

const entry = (championId: number, winRate: number, games: number, pickRate = 0.05): TierEntry => ({ championId, winRate, games, pickRate, tier: "A", winRateChange: null });
const pick = (championId: number, position: string | null, rank: "main" | "secondary" = "main") => ({ championId, position, rank, buildId: null });

const lists = {
  TOP: [entry(1, 0.52, 3000), entry(2, 0.55, 3000), entry(3, 0.58, 40)],
  MIDDLE: [entry(10, 0.51, 4000, 0.2), entry(11, 0.6, 5000)],
  BOTTOM: [entry(20, 0.53, 4000)],
  JUNGLE: [],
  UTILITY: [],
};

describe("queuePool", () => {
  it("keeps the picks of the asked roles, mains first", () => {
    const result = queuePool([pick(2, "TOP", "secondary"), pick(1, "TOP"), pick(10, "MIDDLE")], ["TOP"], lists);
    expect(result.map((r) => r.championId)).toEqual([1, 2]);
    expect(result[0].entry?.winRate).toBe(0.52);
  });
  it("places a pick without a role where it is played most", () => {
    expect(queuePool([pick(10, null)], ["MIDDLE"], lists)[0].position).toBe("MIDDLE");
    expect(queuePool([pick(10, null)], ["TOP"], lists)).toEqual([]);
  });
  it("lists the whole pool when no role was chosen, without repeats", () => {
    const result = queuePool([pick(1, "TOP"), pick(1, "TOP"), pick(20, "BOTTOM")], [], lists);
    expect(result.map((r) => r.championId)).toEqual([1, 20]);
  });
  it("keeps a pick with no data, without an entry", () => {
    expect(queuePool([pick(99, "TOP")], ["TOP"], lists)[0].entry).toBeNull();
  });
});

describe("autofillPicks", () => {
  const easy = (id: number) => (id === 11 ? 8 : 3);
  it("suggests simple, well-sampled champions for the roles not asked for", () => {
    const result = autofillPicks(["MIDDLE"], lists, easy, new Set());
    expect(result.map((r) => r.championId)).toEqual([2, 1, 20]);
    expect(result.every((r) => r.position !== "MIDDLE")).toBe(true);
  });
  it("skips thin samples, hard champions and the pool", () => {
    const result = autofillPicks(["BOTTOM"], lists, easy, new Set([2]));
    expect(result.map((r) => r.championId)).not.toContain(3);
    expect(result.map((r) => r.championId)).not.toContain(11);
    expect(result.map((r) => r.championId)).not.toContain(2);
  });
  it("skips champions Data Dragon does not know", () => {
    expect(autofillPicks([], lists, () => null, new Set())).toEqual([]);
  });
});

describe("autofillPicks at another rank", () => {
  it("orders by the lists it is given, so a bracket's own win rates decide", () => {
    const easy = () => 3;
    const emerald = { ...lists, TOP: [entry(1, 0.52, 3000), entry(2, 0.55, 3000)] };
    const gold = { ...lists, TOP: [entry(1, 0.56, 3000), entry(2, 0.5, 3000)] };
    expect(autofillPicks(["MIDDLE"], emerald, easy, new Set()).filter((p) => p.position === "TOP").map((p) => p.championId)).toEqual([2, 1]);
    expect(autofillPicks(["MIDDLE"], gold, easy, new Set()).filter((p) => p.position === "TOP").map((p) => p.championId)).toEqual([1, 2]);
  });

  it("drops champions whose sample in the bracket is too thin", () => {
    const thin = { ...lists, TOP: [entry(1, 0.6, 30), entry(2, 0.52, 3000)] };
    expect(autofillPicks(["MIDDLE"], thin, () => 3, new Set()).filter((p) => p.position === "TOP").map((p) => p.championId)).toEqual([2]);
  });
});
