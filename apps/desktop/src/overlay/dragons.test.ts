import { describe, expect, it } from "vitest";
import { readDragons } from "./dragons";
import type { LiveEvent } from "./live";
import { sampleGame } from "./sample";

const kill = (time: number, dragonType: string, killerName: string | null): LiveEvent => ({ name: "DragonKill", time, dragonType, inhibKilled: null, killerName });

describe("readDragons", () => {
  it("splits dragons by team, names the soul after the third drake and flags soul point", () => {
    const game = sampleGame();
    game.events = [kill(300, "Fire", "Ally"), kill(620, "Water", "Other"), kill(930, "Earth", "Vizier#TR1"), kill(1240, "Earth", "Ally")];
    expect(readDragons(game, "ORDER")).toEqual({
      ours: ["Fire", "Earth", "Earth"],
      theirs: ["Water"],
      soul: "Earth",
      soulTaken: null,
      soulPoint: { ours: true, theirs: false },
      elders: { ours: 0, theirs: 0 },
    });
  });

  it("reads the soul as taken at four and counts elders", () => {
    const game = sampleGame();
    game.events = ["Fire", "Air", "Hextech", "Hextech"].map((t, i) => kill(300 + i * 300, t, "Enemy")).concat(kill(2000, "Elder", "Top"));
    const read = readDragons(game, "ORDER")!;
    expect(read.soulTaken).toBe("theirs");
    expect(read.soulPoint).toEqual({ ours: false, theirs: false });
    expect(read.elders).toEqual({ ours: 1, theirs: 0 });
  });

  it("skips kills it can't place and returns null before the first dragon", () => {
    const game = sampleGame();
    game.events = [];
    expect(readDragons(game, "ORDER")).toBeNull();
    game.events = [kill(300, "Fire", "SRU_Minion")];
    expect(readDragons(game, "ORDER")).toMatchObject({ ours: [], theirs: [], soul: null });
  });
});
