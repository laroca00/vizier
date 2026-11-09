import { describe, expect, it } from "vitest";
import { confidenceOf, hasEnoughGames, patchOf, wilson } from "./confidence";

describe("wilson", () => {
  it("matches the textbook interval for 50% over 100 games", () => {
    const { low, high } = wilson(0.5, 100);
    expect(low).toBeCloseTo(0.4038, 3);
    expect(high).toBeCloseTo(0.5962, 3);
  });

  it("stays inside 0 and 1 at the edges", () => {
    const { low, high } = wilson(1, 10);
    expect(high).toBe(1);
    expect(low).toBeGreaterThan(0.6);
    expect(wilson(0.5, 0).halfWidth).toBe(0.5);
  });
});

describe("confidenceOf", () => {
  it("grades by the interval width", () => {
    expect(confidenceOf({ games: 1000, winRate: 0.52 })).toBe("reliable");
    expect(confidenceOf({ games: 200, winRate: 0.52 })).toBe("limited");
    expect(confidenceOf({ games: 40, winRate: 0.52 })).toBe("insufficient");
  });

  it("calls data from older patches outdated", () => {
    expect(confidenceOf({ games: 5000, winRate: 0.5, patches: ["16.20", "16.21"], currentPatch: "16.22.1" })).toBe("outdated");
    expect(confidenceOf({ games: 5000, winRate: 0.5, patches: ["16.21", "16.22"], currentPatch: "16.22.1" })).toBe("reliable");
  });

  it("ignores the patch check without both sides", () => {
    expect(confidenceOf({ games: 5000, winRate: 0.5, patches: [], currentPatch: "16.22.1" })).toBe("reliable");
    expect(confidenceOf({ games: 5000, winRate: 0.5, patches: ["16.20"], currentPatch: null })).toBe("reliable");
  });

  it("reduces versions to the patch", () => {
    expect(patchOf("16.22.1")).toBe("16.22");
    expect(patchOf("16.22")).toBe("16.22");
  });
});

describe("hasEnoughGames", () => {
  it("needs a narrow interval, not a fixed game count", () => {
    expect(hasEnoughGames(40, 0.5)).toBe(false);
    expect(hasEnoughGames(400, 0.5)).toBe(true);
    // The same rate is judged on its own interval at either end of the scale.
    expect(hasEnoughGames(60, 0.95)).toBe(true);
  });
});
