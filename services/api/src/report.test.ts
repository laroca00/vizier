import { describe, expect, it } from "vitest";
import { scoreGame, weakestMinutes } from "./report.ts";

const spread = (lo: number, hi: number) => ({ games: 500, quantiles: Array.from({ length: 21 }, (_, i) => lo + ((hi - lo) * i) / 20) });

describe("scoreGame", () => {
  const bench = {
    position: "MIDDLE",
    championId: 103,
    patches: ["16.21"],
    metrics: { cs_pm: spread(5, 9), cs10: spread(50, 90), kill_participation: spread(0.3, 0.7), deaths: spread(1, 9), vision_pm: spread(0.4, 1.2) },
  };

  it("turns each metric into a percentile and averages it per category", () => {
    const game = { matchId: "TR1_1", championId: 103, position: "MIDDLE", win: true, values: { cs_pm: 8, cs10: 70, kill_participation: 0.5, deaths: 3, vision_pm: 0.4 } };
    const { overall, scores } = scoreGame(game, bench);
    expect(scores.map((s) => [s.category, s.score])).toEqual([
      ["farming", 63],
      ["combat", 50],
      ["survival", 75],
      ["vision", 0],
    ]);
    expect(overall).toBe(47);
  });

  it("leaves farming out for supports and skips metrics without a benchmark", () => {
    const game = { matchId: "TR1_1", championId: 40, position: "UTILITY", win: false, values: { cs_pm: 1, damage_share: 0.1, deaths: 5 } };
    expect(scoreGame(game, bench).scores.map((s) => s.category)).toEqual(["survival"]);
  });
});

describe("weakestMinutes", () => {
  it("names the minutes furthest behind the median", () => {
    expect(weakestMinutes([7, 14, 18, 30], [7, 15, 24, 31])).toEqual([3, 2, 4]);
    expect(weakestMinutes([10, 20], [7, 15])).toEqual([]);
  });
});
