import { describe, expect, it } from "vitest";
import type { Counters } from "../api";
import { planBans } from "./banPlanner";

const counters = (matchups: Counters["matchups"]): Counters => ({ patches: ["15.1"], games: 1000, matchups });

describe("ban planner", () => {
  it("merges the sources for one champion and ranks it first", () => {
    const bans = planBans({
      meta: { patches: [], champions: [{ championId: 1, games: 900, winRate: 0.54 }, { championId: 2, games: 800, winRate: 0.53 }] },
      own: { championId: 10, counters: counters([{ championId: 1, games: 600, winRate: 0.44 }]) },
      allies: [],
      unavailable: new Set(),
    });
    expect(bans[0].championId).toBe(1);
    expect(bans[0].reasons.map((r) => r.kind)).toEqual(["meta", "hard"]);
    expect(bans[1].championId).toBe(2);
  });

  it("names a hard matchup only when its whole interval is under 50%", () => {
    const bans = planBans({
      meta: null,
      own: { championId: 10, counters: counters([{ championId: 5, games: 120, winRate: 0.44 }, { championId: 6, games: 900, winRate: 0.44 }]) },
      allies: [],
      unavailable: new Set(),
    });
    expect(bans.map((b) => b.championId)).toEqual([6]);
  });

  it("skips banned and picked champions and thin samples", () => {
    const bans = planBans({
      meta: { patches: [], champions: [{ championId: 1, games: 900, winRate: 0.54 }, { championId: 2, games: 20, winRate: 0.6 }] },
      own: { championId: 10, counters: counters([{ championId: 3, games: 10, winRate: 0.3 }, { championId: 4, games: 300, winRate: 0.4 }]) },
      allies: [],
      unavailable: new Set([1]),
    });
    expect(bans.map((b) => b.championId)).toEqual([4]);
  });

  it("finds champions that are strong into the allies", () => {
    const bans = planBans({
      meta: null,
      own: null,
      allies: [
        { championId: 20, counters: counters([{ championId: 7, games: 600, winRate: 0.4 }]) },
        { championId: 21, counters: counters([{ championId: 7, games: 600, winRate: 0.45 }, { championId: 8, games: 600, winRate: 0.55 }]) },
      ],
      unavailable: new Set(),
    });
    expect(bans).toHaveLength(1);
    const reason = bans[0].reasons[0];
    expect(reason.kind).toBe("team");
    if (reason.kind === "team") {
      expect(reason.allies).toEqual([20, 21]);
      expect(reason.games).toBe(1200);
      expect(reason.winRate).toBeCloseTo(0.575);
    }
  });
});
