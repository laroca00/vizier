import { describe, expect, it } from "vitest";
import { curveFor, curveVerdict, type RankCurveDoc } from "./rankCurve";

const brackets = ["all", "gold_minus", "platinum_plus", "emerald_plus", "diamond_plus", "master_plus"] as const;
const doc = (points: ([number, number, number] | null)[]): RankCurveDoc => ({
  patches: ["16.22"],
  brackets: [...brackets],
  entries: [{ championId: 1, position: "MIDDLE", points }],
});

describe("curveFor", () => {
  it("returns the five ladder brackets in order and skips empty ones", () => {
    const points = curveFor(doc([[9000, 0.5, 0.05], [3000, 0.48, 0.04], [4000, 0.5, 0.05], [2000, 0.51, 0.05], null, [30, 0.55, 0.03]]), 1, "MIDDLE");
    expect(points.map((p) => p.bracket)).toEqual(["gold_minus", "platinum_plus", "emerald_plus", "master_plus"]);
    expect(points[3].enough).toBe(false);
  });

  it("is empty for an unknown champion or role", () => {
    expect(curveFor(doc([null, null, null, null, null, null]), 2, "MIDDLE")).toEqual([]);
    expect(curveFor(doc([null, null, null, null, null, null]), 1, "TOP")).toEqual([]);
  });
});

describe("curveVerdict", () => {
  const build = (low: [number, number], high: [number, number]) =>
    curveFor(doc([null, [low[0], low[1], 0.05], null, null, null, [high[0], high[1], 0.05]]), 1, "MIDDLE");

  it("says better at high rank only when the intervals do not overlap", () => {
    expect(curveVerdict(build([20000, 0.47], [20000, 0.53]))).toBe("better_high");
    expect(curveVerdict(build([20000, 0.53], [20000, 0.47]))).toBe("better_low");
  });

  it("stays quiet for a close or thin difference", () => {
    expect(curveVerdict(build([20000, 0.5], [20000, 0.505]))).toBeNull();
    expect(curveVerdict(build([200, 0.45], [200, 0.55]))).toBeNull();
  });
});
