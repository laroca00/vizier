import { describe, expect, it } from "vitest";
import type { Matchups } from "./poolCoverage";
import { suggestForGaps, type Candidate } from "./poolSuggest";

const m = (championId: number, winRate: number, games = 100) => ({ championId, winRate, games });
const counters = new Map<number, Matchups>([
  [1, [m(10, 0.56), m(11, 0.54)]],
  [2, [m(10, 0.58), m(11, 0.5)]],
  [3, [m(10, 0.6)]],
  [4, [m(10, 0.57, 5), m(11, 0.57, 5)]],
]);
const candidates: Candidate[] = [
  { championId: 1, tier: "A", tags: ["Mage"] },
  { championId: 2, tier: "B", tags: ["Assassin"] },
  { championId: 3, tier: "S", tags: ["Mage"] },
  { championId: 4, tier: "S", tags: ["Mage"] },
];

describe("suggestForGaps", () => {
  it("ranks by win rate against the gaps, nudged by tier", () => {
    const list = suggestForGaps([10, 11], candidates, counters, []);
    expect(list.map((s) => s.championId)).toEqual([1, 2]);
    expect(list[0]).toMatchObject({ games: 200, winRate: 0.55 });
    expect(list[0].beats.map((b) => b.opponentId)).toEqual([10, 11]);
  });
  it("skips champions with rates against too few of the gaps or too few games", () => {
    const ids = suggestForGaps([10, 11], candidates, counters, []).map((s) => s.championId);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
  });
  it("prefers champions that share a class with the pool when it is close", () => {
    const close = new Map<number, Matchups>([[1, [m(10, 0.55), m(11, 0.55)]], [2, [m(10, 0.552), m(11, 0.552)]]]);
    const list = suggestForGaps([10, 11], [{ championId: 1, tier: "B", tags: ["Mage"] }, { championId: 2, tier: "B", tags: ["Assassin"] }], close, ["Mage"]);
    expect(list.map((s) => s.championId)).toEqual([1, 2]);
  });
  it("gives nothing without gaps", () => {
    expect(suggestForGaps([], candidates, counters, [])).toEqual([]);
  });
});
