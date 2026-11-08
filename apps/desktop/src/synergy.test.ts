import { describe, expect, it } from "vitest";
import { groupAllies } from "./synergy";

const ally = (championId: number, position: string, games: number, winRate: number) => ({ championId, position, games, winRate });

describe("groupAllies", () => {
  const allies = [ally(1, "UTILITY", 90, 0.5), ally(2, "UTILITY", 50, 0.56), ally(3, "JUNGLE", 40, 0.53), ally(4, "UTILITY", 5, 0.9), ally(5, "TOP", 30, 0.51)];

  it("puts the duo partner role first and sorts by win rate", () => {
    const groups = groupAllies(allies, "BOTTOM");
    expect(groups.map((g) => g.position)).toEqual(["UTILITY", "TOP", "JUNGLE"]);
    expect(groups[0]).toMatchObject({ duo: true });
    expect(groups[0].allies.map((a) => a.championId)).toEqual([2, 1]);
  });
  it("drops pairings with too few games", () => {
    expect(groupAllies(allies, "BOTTOM")[0].allies.some((a) => a.championId === 4)).toBe(false);
  });
  it("marks jungle and mid as each other's duo", () => {
    expect(groupAllies([ally(7, "JUNGLE", 30, 0.5)], "MIDDLE")[0].duo).toBe(true);
    expect(groupAllies([ally(7, "TOP", 30, 0.5)], "TOP")[0].duo).toBe(false);
  });
  it("limits each role", () => {
    expect(groupAllies(allies, "TOP", 1)[0].allies).toHaveLength(1);
  });
});
