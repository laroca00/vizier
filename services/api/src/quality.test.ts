import { describe, expect, it } from "vitest";
import { dropReason } from "./quality.ts";
import type { Participant } from "./riot/types.ts";

const player = (extra: Partial<Participant> = {}): Participant =>
  ({ puuid: "p", championId: 1, teamPosition: "TOP", win: true, kills: 3, assists: 4, goldEarned: 9000, totalDamageDealtToChampions: 12000, timePlayed: 1500, ...extra }) as Participant;
const game = (...odd: Partial<Participant>[]) => ({ gameDuration: 1500, participants: [...odd.map(player), ...Array.from({ length: 10 - odd.length }, () => player())] });

describe("dropReason", () => {
  it("keeps an ordinary game", () => {
    expect(dropReason(game())).toBeNull();
  });
  it("drops early surrenders, from either flag", () => {
    expect(dropReason(game({ gameEndedInEarlySurrender: true }))).toBe("surrender");
    expect(dropReason(game({ teamEarlySurrendered: true }))).toBe("surrender");
  });
  it("drops a game where a player was gone for a quarter of it", () => {
    expect(dropReason(game({ timePlayed: 900 }))).toBe("afk");
    expect(dropReason(game({ timePlayed: 1400 }))).toBeNull();
  });
  it("drops a game where a player did nothing for the whole game", () => {
    expect(dropReason(game({ kills: 0, assists: 0, totalDamageDealtToChampions: 80, goldEarned: 3000 }))).toBe("afk");
  });
  it("keeps quiet players who were involved, who hit anything, who earned gold, or when fields are missing", () => {
    expect(dropReason(game({ kills: 0, assists: 2, totalDamageDealtToChampions: 80, goldEarned: 3000 }))).toBeNull();
    expect(dropReason(game({ kills: 0, assists: 0, totalDamageDealtToChampions: 3000, goldEarned: 3000 }))).toBeNull();
    expect(dropReason(game({ kills: 0, assists: 0, totalDamageDealtToChampions: 80, goldEarned: 9000 }))).toBeNull();
    expect(dropReason(game({ kills: 0, assists: 0, totalDamageDealtToChampions: undefined }))).toBeNull();
  });
  it("does not judge activity in a short game", () => {
    expect(dropReason({ ...game({ kills: 0, assists: 0, totalDamageDealtToChampions: 0, goldEarned: 1000, timePlayed: 500 }), gameDuration: 500 })).toBeNull();
  });
});
