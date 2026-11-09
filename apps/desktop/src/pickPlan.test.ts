import { describe, expect, it } from "vitest";
import { addToPlan, firstAvailable, moveInPlan, parsePlan, removeFromPlan } from "./pickPlan";

describe("pick plan", () => {
  it("keeps three picks and two bans without duplicates", () => {
    let plan = {};
    for (const id of [1, 2, 3, 4, 3]) plan = addToPlan(plan, "MIDDLE", "picks", id);
    for (const id of [9, 8, 7]) plan = addToPlan(plan, "MIDDLE", "bans", id);
    expect(plan).toEqual({ MIDDLE: { picks: [1, 2, 3], bans: [9, 8] } });
  });
  it("reorders and removes, dropping an empty role", () => {
    let plan = addToPlan(addToPlan({}, "TOP", "picks", 1), "TOP", "picks", 2);
    plan = moveInPlan(plan, "TOP", "picks", 1, 0);
    expect(plan.TOP.picks).toEqual([2, 1]);
    plan = removeFromPlan(removeFromPlan(plan, "TOP", "picks", 2), "TOP", "picks", 1);
    expect(plan).toEqual({});
  });
  it("ignores moves outside the list", () => {
    const plan = addToPlan({}, "TOP", "picks", 1);
    expect(moveInPlan(plan, "TOP", "picks", 0, 5)).toEqual(plan);
  });
  it("drops malformed stored plans", () => {
    expect(parsePlan({ TOP: { picks: [1, "x", 1, 2, 3, 4], bans: null }, JUNGLE: {} })).toEqual({ TOP: { picks: [1, 2, 3], bans: [] } });
    expect(parsePlan(null)).toEqual({});
  });
});

describe("firstAvailable", () => {
  const none = new Set<number>();
  it("skips banned, taken and unowned champions", () => {
    expect(firstAvailable([1, 2, 3, 4], { banned: new Set([1]), taken: new Set([2]), allowed: new Set([3, 4]) })).toBe(3);
    expect(firstAvailable([1, 2], { banned: new Set([1, 2]), taken: none })).toBeNull();
    expect(firstAvailable([5], { banned: none, taken: none, allowed: new Set([6]) })).toBeNull();
  });
});
