import { describe, expect, it } from "vitest";
import { winRateShift } from "./winRateShift";

describe("winRateShift", () => {
  it("derives the old win rate from the change", () => {
    const shift = winRateShift({ winRate: 0.52, winRateChange: 0.015, games: 400 })!;
    expect(shift.before).toBeCloseTo(0.505);
    expect(shift.after).toBe(0.52);
    expect(shift.games).toBe(400);
  });

  it("stays quiet without a change or with few games", () => {
    expect(winRateShift({ winRate: 0.5, winRateChange: null, games: 900 })).toBeNull();
    expect(winRateShift({ winRate: 0.5, winRateChange: 0.01, games: 40 })).toBeNull();
    expect(winRateShift(null)).toBeNull();
  });
});
