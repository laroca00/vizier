import { describe, expect, it } from "vitest";
import type { TierEntry } from "./api";
import { poolMoves } from "./poolMoves";

const e = (championId: number, winRate: number, winRateChange: number | null, pickRate = 0.1): TierEntry => ({ championId, winRate, winRateChange, pickRate, games: 400, tier: "A" });

describe("poolMoves", () => {
  const lists = { MIDDLE: [e(1, 0.52, 0.01), e(2, 0.49, -0.03)], TOP: [e(3, 0.5, null), e(2, 0.5, 0.02, 0.01)] };
  it("reads each pick in its role and sorts by the size of the move", () => {
    const moves = poolMoves([{ championId: 1, position: "MIDDLE" }, { championId: 2, position: null }, { championId: 3, position: "TOP" }], lists);
    expect(moves.map((m) => [m.championId, m.position, m.winRateChange])).toEqual([[2, "MIDDLE", -0.03], [1, "MIDDLE", 0.01], [3, "TOP", null]]);
  });
  it("skips picks with no entry and duplicates", () => {
    expect(poolMoves([{ championId: 9, position: "TOP" }, { championId: 1, position: "MIDDLE" }, { championId: 1, position: "MIDDLE" }], lists)).toHaveLength(1);
  });
});
