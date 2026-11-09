import { describe, expect, it } from "vitest";
import type { Build, Counters } from "../api";
import { championSummary } from "./championSummary";

const build = {
  patches: ["16.22"],
  games: 2000,
  winRate: 0.5,
  vs: null,
  runes: [{ primaryStyle: 8100, subStyle: 8300, perks: [8112, 8143], games: 900, winRate: 0.51 }],
  spells: [],
  items: [{ id: 3089, games: 10, winRate: 0.5 }],
  startItems: null,
  coreItems: { ids: [6655, 3020, 4645, 3089], games: 400, winRate: 0.53 },
  skills: { maxOrder: [1, 3, 2], firstLevels: [1, 2, 3], games: 900, winRate: 0.5 },
} as Build;

const counters: Counters = {
  patches: ["16.22"],
  games: 5000,
  matchups: [
    { championId: 1, games: 1500, winRate: 0.45 },
    { championId: 2, games: 1500, winRate: 0.56 },
    { championId: 3, games: 10, winRate: 0.2 },
    { championId: 4, games: 1500, winRate: 0.5 },
  ],
};

describe("championSummary", () => {
  it("picks the keystone, three core items, the max order and readable matchups", () => {
    expect(championSummary(build, counters)).toEqual({
      keystone: 8112,
      core: [6655, 3020, 4645],
      maxOrder: [1, 3, 2],
      hardest: { championId: 1, winRate: 0.45, games: 1500 },
      easiest: { championId: 2, winRate: 0.56, games: 1500 },
    });
  });

  it("leaves matchups out when nothing is clearly above or below even", () => {
    const even: Counters = { ...counters, matchups: [{ championId: 4, games: 1500, winRate: 0.5 }] };
    expect(championSummary(build, even)).toMatchObject({ hardest: null, easiest: null });
    expect(championSummary(build, null)).toMatchObject({ hardest: null, easiest: null });
    expect(championSummary(null, counters)).toBeNull();
  });
});
