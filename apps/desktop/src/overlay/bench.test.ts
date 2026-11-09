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

describe("kills and assists", () => {
  const withKda = [
    { minute: 5, games: 40, cs: 40, level: 4, kdaGames: 30, kills: 0.5, deaths: 0.4, assists: 0.6, killParticipation: 0.4 },
    { minute: 10, games: 30, cs: 80, level: 6, kdaGames: 25, kills: 1.5, deaths: 1, assists: 2.5, killParticipation: 0.6 },
  ];
  it("interpolates counts from zero and shares between samples", () => {
    const early = expectedAt(withKda, 2.5)!;
    expect(early.kda).toEqual({ kills: 0.25, deaths: 0.2, assists: 0.3, games: 30 });
    expect(early.kp).toBeUndefined();
    const mid = expectedAt(withKda, 7.5)!;
    expect(mid.kda).toMatchObject({ kills: 1, games: 25 });
    expect(mid.kda!.deaths).toBeCloseTo(0.7);
    expect(mid.kda!.assists).toBeCloseTo(1.55);
    expect(mid.kp).toEqual({ share: 0.5, games: 25 });
  });
  it("leaves them out where the data has none", () => {
    expect(expectedAt(minutes, 7.5)?.kda).toBeUndefined();
    expect(expectedAt([{ ...withKda[0] }, { minute: 10, games: 30, cs: 80, level: 6 }], 7.5)?.kda).toBeUndefined();
  });
  it("reads your share against the average", () => {
    const read = benchRead({ cs: 50, level: 5, kills: 2, assists: 3, teamKills: 8 }, expectedAt(withKda, 7.5)!);
    expect(read.kp).toEqual({ avg: 50, own: 63, diff: 13, games: 25 });
    expect(read.kda).toMatchObject({ kills: 1, deaths: 0.7, games: 25 });
  });
  it("has no share while the team has no kill", () => {
    expect(benchRead({ cs: 5, level: 5, kills: 0, assists: 0, teamKills: 0 }, expectedAt(withKda, 7.5)!).kp).toMatchObject({ own: null, diff: null });
  });
});
