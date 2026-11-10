import { describe, expect, it } from "vitest";
import { lengthLean, lengthsAreThick, phaseRates } from "./lengthStats";

const rows = (games: number[], rates: number[]) => games.map((g, bucket) => ({ bucket, games: g, winRate: rates[bucket] }));

describe("phaseRates", () => {
  it("sums buckets into early, mid and late with a games-weighted win rate", () => {
    const rates = phaseRates(rows([100, 300, 200, 200, 100], [0.6, 0.5, 0.5, 0.4, 0.45]));
    expect(rates.early).toEqual({ games: 400, winRate: 0.525 });
    expect(rates.mid).toEqual({ games: 400, winRate: 0.45 });
    expect(rates.late).toEqual({ games: 100, winRate: 0.45 });
  });

  it("leaves a phase without games null, and everything null without data", () => {
    expect(phaseRates(rows([0, 0, 50, 50, 0], [0, 0, 0.5, 0.5, 0])).early).toBeNull();
    expect(phaseRates(undefined)).toEqual({ early: null, mid: null, late: null });
  });
});

describe("lengthsAreThick", () => {
  it("needs a usable sample in all three phases", () => {
    expect(lengthsAreThick(rows([2000, 2000, 2000, 2000, 2000], [0.5, 0.5, 0.5, 0.5, 0.5]))).toBe(true);
    expect(lengthsAreThick(rows([2000, 2000, 2000, 2000, 30], [0.5, 0.5, 0.5, 0.5, 0.5]))).toBe(false);
    expect(lengthsAreThick(undefined)).toBe(false);
  });
});

describe("lengthLean", () => {
  it("names the side whose interval clears the other", () => {
    expect(lengthLean({ short: { games: 1000, winRate: 0.58 }, long: { games: 1000, winRate: 0.5 } })).toBe("short");
    expect(lengthLean({ short: { games: 1000, winRate: 0.5 }, long: { games: 1000, winRate: 0.58 } })).toBe("long");
  });
  it("stays quiet when the intervals overlap or the data is missing", () => {
    expect(lengthLean({ short: { games: 80, winRate: 0.56 }, long: { games: 80, winRate: 0.5 } })).toBeNull();
    expect(lengthLean(undefined)).toBeNull();
  });
});
