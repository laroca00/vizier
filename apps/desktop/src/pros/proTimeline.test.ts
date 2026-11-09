import { describe, expect, it } from "vitest";
import type { ProBuild } from "../api";
import { buySteps, compareProBuilds, finishedOrder, opening, skillLetters } from "./proTimeline";

const complete = (id: number) => id >= 3000;
const game = (patch: Partial<ProBuild>): ProBuild =>
  ({ matchId: "m", player: "A", team: "T", platform: "kr", patch: "16.21", gameStart: 0, duration: 1800, championId: 103, opponentChampionId: 238, position: "MIDDLE", win: true, kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, runes: "8100:8300:8112,8126,8139,8135:8304,8347:5008,5008,5011", spells: [4, 14], items: [], startItems: [1056, 2003], skillOrder: [1, 2, 3, 1], purchases: [1056, 2003, 1036, 1036, 3057, 3100], ...patch }) as ProBuild;

describe("buySteps", () => {
  it("folds a purchase repeated in a row and marks finished items", () => {
    expect(buySteps([1036, 1036, 3057, 1036], complete)).toEqual([
      { id: 1036, complete: false, count: 2 },
      { id: 3057, complete: true, count: 1 },
      { id: 1036, complete: false, count: 1 },
    ]);
  });
});

describe("finishedOrder and skills", () => {
  it("keeps finished items once, in order", () => {
    expect(finishedOrder([3100, 1036, 3057, 3100], complete)).toEqual([3100, 3057]);
  });
  it("turns level-ups into letters", () => {
    expect(skillLetters([1, 2, 3, 4, 9])).toEqual(["Q", "W", "E", "R", "?"]);
    expect(opening([2, 1, 3, 1])).toEqual(["W", "Q", "E"]);
  });
});

describe("compareProBuilds", () => {
  const a = game({});
  const b = game({ purchases: [1056, 3057, 3089], runes: "8100:8200:8112,8126,8139,8135:8304,8347:5008,5008,5011", spells: [14, 4], skillOrder: [2, 1, 3] });
  const c = compareProBuilds(a, b, complete);
  it("splits finished items into shared and own", () => {
    expect(c.sharedItems).toEqual([3057]);
    expect(c.onlyA).toEqual([3100]);
    expect(c.onlyB).toEqual([3089]);
  });
  it("compares keystone, page, spells and opening", () => {
    expect(c.sameKeystone).toBe(true);
    expect(c.sameRunePage).toBe(false);
    expect(c.sameSpells).toBe(true);
    expect(c.sameOpening).toBe(false);
  });
});
