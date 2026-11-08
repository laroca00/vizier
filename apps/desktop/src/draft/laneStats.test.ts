import { describe, expect, it } from "vitest";
import { laneLines, signedNumber } from "./laneStats";

describe("laneLines", () => {
  it("is null when no timeline games are in", () => {
    expect(laneLines({ games: 0 })).toBeNull();
  });
  it("lists CS and gold leads at 10 and 15 minutes", () => {
    const lines = laneLines({ games: 14, csDiff10: 2.5, csDiff15: -1, goldDiff10: 120, goldDiff15: -300, firstBloodRate: 0.2 });
    expect(lines?.map((l) => [l.key, l.value])).toEqual([["cs10", 2.5], ["cs15", -1], ["gold10", 120], ["gold15", -300]]);
  });
});

describe("signedNumber", () => {
  it("marks the direction", () => {
    expect(signedNumber(12)).toBe("+12");
    expect(signedNumber(-3)).toBe("−3");
    expect(signedNumber(0.04)).toBe("0");
    expect(signedNumber(2.46, 1)).toBe("+2.5");
  });
});
