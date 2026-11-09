import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { platformOf, scoutSides, scoutTags } from "./scouting";

const rank = { tier: "GOLD", division: "I", lp: 10, wins: 10, losses: 10, winStreak: false };

describe("scoutTags", () => {
  it("calls out a first time on the champion and a main", () => {
    expect(scoutTags({ mastery: null, rank })).toEqual(["firstTime"]);
    expect(scoutTags({ mastery: { level: 3, points: 1200 }, rank })).toEqual(["firstTime"]);
    expect(scoutTags({ mastery: { level: 7, points: 250000 }, rank })).toEqual(["main"]);
    expect(scoutTags({ mastery: { level: 5, points: 40000 }, rank })).toEqual([]);
  });
  it("reports a win streak only when Riot flags one", () => {
    expect(scoutTags({ mastery: { level: 5, points: 40000 }, rank: { ...rank, winStreak: true } })).toEqual(["winStreak"]);
    expect(scoutTags({ mastery: { level: 5, points: 40000 }, rank: null })).toEqual([]);
  });
});

describe("platformOf", () => {
  it("maps the servers Vizier reads", () => {
    expect(platformOf("TR")).toBe("tr1");
    expect(platformOf("euw")).toBe("euw1");
    expect(platformOf("LAN")).toBeNull();
    expect(platformOf(null)).toBeNull();
  });
});

describe("scoutSides", () => {
  const champion = (key: number, magic: number): Champion => ({ key, id: `C${key}`, name: `C${key}`, info: { attack: 10 - magic, defense: 0, magic, difficulty: 1 } }) as unknown as Champion;
  it("puts the player's side first and joins the lookups by puuid", () => {
    const roster = [
      { puuid: "a", championId: 1, position: "top", team: 1 as const },
      { puuid: "b", championId: 2, position: "top", team: 2 as const },
    ];
    const champs = new Map([[1, champion(1, 10)], [2, champion(2, 0)]]);
    const sides = scoutSides(roster, 2, champs, [{ puuid: "b", championId: 2, rank: null, mastery: null }]);
    expect(sides.ours[0].player.puuid).toBe("b");
    expect(sides.ours[0].scout).not.toBeNull();
    expect(sides.theirs[0].scout).toBeNull();
    expect(sides.theirDamage.ap).toBeGreaterThan(sides.ourDamage.ap);
  });
});
