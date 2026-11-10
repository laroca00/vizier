import { describe, expect, it } from "vitest";
import { tierTrend, trendOf, type ChampionHistoryDoc } from "./history";

const doc: ChampionHistoryDoc = {
  roles: {
    MIDDLE: {
      emerald_plus: {
        "16.9": [["2026-10-01", 500, 0.4, 0.1, 0]],
        "16.10": [
          ["2026-11-01", 40, 0.5, 0.1, 0.02],
          ["2026-11-02", 90, 0.52, 0.1, 0.02],
          ["2026-11-03", 150, 0.55, 0.11, 0.03],
        ],
      },
    },
  },
};

describe("trendOf", () => {
  it("uses the newest patch, sorted as numbers", () => {
    expect(trendOf(doc, "MIDDLE", "emerald_plus")).toEqual({ values: [0.5, 0.52, 0.55], games: 150, first: 0.5, last: 0.55 });
    expect(trendOf(doc, "MIDDLE", "emerald_plus", 3)?.values).toEqual([0.1, 0.1, 0.11]);
  });
  it("is null for a missing role, a thin sample or too few days", () => {
    expect(trendOf(doc, "TOP", "emerald_plus")).toBeNull();
    expect(trendOf(doc, "MIDDLE", "gold_minus")).toBeNull();
    expect(trendOf({ roles: { MIDDLE: { emerald_plus: { "16.10": doc.roles.MIDDLE!.emerald_plus!["16.10"].slice(0, 2) } } } }, "MIDDLE", "emerald_plus")).toBeNull();
    expect(trendOf({ roles: { MIDDLE: { emerald_plus: { "16.10": doc.roles.MIDDLE!.emerald_plus!["16.10"].map((p) => [p[0], 20, p[2], p[3], p[4]] as [string, number, number, number, number]) } } } }, "MIDDLE", "emerald_plus")).toBeNull();
    expect(trendOf(null, "MIDDLE", "emerald_plus")).toBeNull();
  });
});

describe("tierTrend", () => {
  it("skips days without games", () => {
    const tier = { patch: "16.10", days: ["a", "b", "c", "d"], champions: { 103: { games: [0, 60, 120, 200], winRate: [0, 0.5, 0.51, 0.53] } } };
    expect(tierTrend(tier, 103)).toEqual({ values: [0.5, 0.51, 0.53], games: 200, first: 0.5, last: 0.53 });
    expect(tierTrend(tier, 1)).toBeNull();
  });
});
