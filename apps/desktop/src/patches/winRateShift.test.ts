import { describe, expect, it } from "vitest";
import { clearDirection, winRateShift } from "./winRateShift";

const rate = (patch: string, games: number, winRate: number) => ({ patch, games, winRate });

describe("winRateShift", () => {
  it("reads each patch with its own games", () => {
    const shift = winRateShift({ patchRates: [rate("16.22", 900, 0.52), rate("16.21", 1200, 0.5)] })!;
    expect(shift).toMatchObject({ before: 0.5, after: 0.52, beforeGames: 1200, afterGames: 900, beforePatch: "16.21", afterPatch: "16.22" });
  });

  it("waits until the new patch has enough games", () => {
    expect(winRateShift({ patchRates: [rate("16.22", 40, 0.6), rate("16.21", 1200, 0.5)] })).toBeNull();
  });

  it("stays quiet with one patch, no per-patch rates or no overview", () => {
    expect(winRateShift({ patchRates: [rate("16.22", 900, 0.5)] })).toBeNull();
    expect(winRateShift({})).toBeNull();
    expect(winRateShift(null)).toBeNull();
  });
});

describe("clearDirection", () => {
  const shift = (before: number, after: number, games: number) => winRateShift({ patchRates: [rate("16.22", games, after), rate("16.21", games, before)] });
  it("names a move whose intervals do not overlap", () => {
    expect(clearDirection(shift(0.47, 0.53, 2000))).toBe("rose");
    expect(clearDirection(shift(0.53, 0.47, 2000))).toBe("fell");
  });
  it("stays quiet for overlap, tiny moves and no shift", () => {
    expect(clearDirection(shift(0.49, 0.52, 400))).toBeNull();
    expect(clearDirection(shift(0.5, 0.505, 100000))).toBeNull();
    expect(clearDirection(null)).toBeNull();
  });
});
