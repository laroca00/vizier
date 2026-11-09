import { describe, expect, it } from "vitest";
import type { Counters } from "../api";
import { matchupRecord, planShown, PLAN_UNTIL, type Plan } from "./plan";

const counters: Counters = {
  patches: ["16.22"],
  games: 5000,
  matchups: [
    { championId: 238, games: 1200, winRate: 0.53 },
    { championId: 7, games: 12, winRate: 0.75 },
  ],
};

describe("matchupRecord", () => {
  it("reads the row for the opponent with its confidence", () => {
    expect(matchupRecord(counters, 238)).toEqual({ winRate: 0.53, games: 1200, confidence: "reliable" });
  });

  it("gives nothing for a thin sample, an unknown opponent or no data", () => {
    expect(matchupRecord(counters, 7)).toBeNull();
    expect(matchupRecord(counters, 1)).toBeNull();
    expect(matchupRecord(null, 238)).toBeNull();
    expect(matchupRecord(counters, null)).toBeNull();
  });
});

describe("planShown", () => {
  const plan: Plan = { opponent: "Zed", opponentKey: "Zed", matchup: null, threat: null, note: "dodge the shuriken" };

  it("shows in the first two minutes when there is something to say", () => {
    expect(planShown(30, plan, false)).toBe(true);
    expect(planShown(PLAN_UNTIL, plan, false)).toBe(false);
    expect(planShown(30, { ...plan, note: null }, false)).toBe(false);
    expect(planShown(30, null, false)).toBe(false);
  });

  it("always shows while the player arranges the boxes", () => {
    expect(planShown(900, { ...plan, note: null }, true)).toBe(true);
  });
});
