import { describe, expect, it } from "vitest";
import { eloShifts, sortedShifts } from "./eloShift";
import type { RankCurveDoc } from "./rankCurve";

const brackets = ["all", "gold_minus", "platinum_plus", "emerald_plus", "diamond_plus", "master_plus"] as const;
const entry = (championId: number, position: string, low: [number, number] | null, high: [number, number] | null) => ({
  championId,
  position,
  points: [null, low ? [low[0], low[1], 0.05] : null, null, null, null, high ? [high[0], high[1], 0.05] : null] as RankCurveDoc["entries"][number]["points"],
});
const doc: RankCurveDoc = {
  patches: ["16.22"],
  brackets: [...brackets],
  entries: [
    entry(1, "MIDDLE", [20000, 0.47], [20000, 0.53]),
    entry(2, "MIDDLE", [20000, 0.53], [20000, 0.47]),
    entry(3, "TOP", [20000, 0.5], [20000, 0.505]),
    entry(4, "MIDDLE", [20000, 0.45], [40, 0.6]),
    entry(5, "MIDDLE", [20000, 0.45], null),
  ],
};

describe("eloShifts", () => {
  it("keeps only champions with enough games at both ends", () => {
    expect(eloShifts(doc, { position: null, minGames: 500 }).map((s) => s.championId)).toEqual([1, 2, 3]);
  });

  it("filters by role and minimum games", () => {
    expect(eloShifts(doc, { position: "TOP", minGames: 500 }).map((s) => s.championId)).toEqual([3]);
    expect(eloShifts(doc, { position: null, minGames: 50000 })).toEqual([]);
  });

  it("gives a verdict only when the intervals do not overlap", () => {
    const [up, down, flat] = eloShifts(doc, { position: null, minGames: 500 });
    expect(up.verdict).toBe("better_high");
    expect(down.verdict).toBe("better_low");
    expect(flat.verdict).toBeNull();
  });

  it("sorts climbers and fallers", () => {
    const shifts = eloShifts(doc, { position: null, minGames: 500 });
    expect(sortedShifts(shifts, "rises").map((s) => s.championId)).toEqual([1, 3, 2]);
    expect(sortedShifts(shifts, "falls").map((s) => s.championId)).toEqual([2, 3, 1]);
  });

  it("is empty when the document lacks an end bracket", () => {
    expect(eloShifts({ ...doc, brackets: ["all"] }, { position: null, minGames: 1 })).toEqual([]);
  });
});
