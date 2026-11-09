import { describe, expect, it } from "vitest";
import { benchRead, expectedAt, pushHistory, sparkline } from "./bench";

const minutes = [
  { minute: 5, games: 40, cs: 40, level: 4 },
  { minute: 10, games: 30, cs: 80, level: 6 },
  { minute: 15, games: 25, cs: 120, level: 8 },
];

describe("expectedAt", () => {
  it("returns a sample minute as it is", () => {
    expect(expectedAt(minutes, 10)).toEqual({ cs: 80, level: 6, games: 30 });
  });
  it("interpolates and takes the smaller game count", () => {
    expect(expectedAt(minutes, 7.5)).toEqual({ cs: 60, level: 5, games: 30 });
  });
  it("starts from nothing at minute zero", () => {
    expect(expectedAt(minutes, 2.5)).toEqual({ cs: 20, level: 2.5, games: 40 });
  });
  it("stops after minute 15 and without data", () => {
    expect(expectedAt(minutes, 15.5)).toBeNull();
    expect(expectedAt([], 5)).toBeNull();
  });
});

describe("benchRead", () => {
  it("states the gap to the average", () => {
    expect(benchRead({ cs: 92, level: 6 }, { cs: 80, level: 6.5, games: 30 })).toEqual({ cs: 80, csDiff: 12, level: 6.5, levelDiff: -0.5, games: 30 });
  });
});

describe("history", () => {
  it("keeps one point per ten seconds", () => {
    let h = pushHistory([], 0, 1);
    h = pushHistory(h, 4, 2);
    h = pushHistory(h, 10, 3);
    expect(h.map((p) => p.diff)).toEqual([1, 3]);
  });
  it("draws nothing for a single point and scales the rest", () => {
    expect(sparkline([1], 100, 20)).toBe("");
    expect(sparkline([0, 5, -5], 100, 20).split(" ")).toHaveLength(3);
  });
});
