import { describe, expect, it } from "vitest";
import type { LiveGame } from "./live";
import { fallenPlayers, openObjectives, readWindow, type Fallen } from "./opportunity";
import { sampleGame } from "./sample";

const dead = (game: LiveGame, riotId: string, respawnTimer: number) => {
  const p = game.players.find((x) => x.riotId === riotId)!;
  p.isDead = true;
  p.respawnTimer = respawnTimer;
};

describe("fallenPlayers", () => {
  it("lists dead players with the time they are back, soonest first", () => {
    const game = sampleGame();
    game.players.forEach((p) => (p.isDead = false));
    dead(game, "Enemy#TR1", 30);
    dead(game, "Top#TR1", 12);
    // Alive players keep their last timer; it must be ignored.
    game.players.find((p) => p.riotId === "Other#TR1")!.respawnTimer = 40;
    expect(fallenPlayers(game, "ORDER")).toEqual([
      { champion: "Garen", ours: true, backAt: game.gameTime + 12 },
      { champion: "Zed", ours: false, backAt: game.gameTime + 30 },
    ]);
  });
});

describe("readWindow", () => {
  const f = (ours: boolean, backAt: number): Fallen => ({ champion: "X", ours, backAt });

  it("opens a push window when two or more enemies are down and outnumber our dead", () => {
    const w = readWindow([f(false, 1240), f(false, 1260), f(true, 1225)], 1210, [], true);
    expect(w).toEqual({ kind: "push", down: 2, seconds: 30, open: ["baron", "dragon"] });
  });

  it("warns when we are the ones down", () => {
    expect(readWindow([f(true, 640), f(true, 660)], 600, [], true)).toEqual({ kind: "danger", down: 2, seconds: 40 });
  });

  it("says nothing for an even trade, a single death or a closing window", () => {
    expect(readWindow([f(false, 640), f(false, 660), f(true, 640), f(true, 650)], 600, [], true)).toBeNull();
    expect(readWindow([f(false, 640)], 600, [], true)).toBeNull();
    expect(readWindow([f(false, 605), f(false, 660)], 600, [], true)).toBeNull();
  });

  it("drops players who are already back", () => {
    expect(readWindow([f(false, 590), f(false, 640), f(false, 650)], 600, [], true)).toMatchObject({ down: 2, seconds: 40 });
  });

  it("names no objectives outside the Rift", () => {
    expect(readWindow([f(false, 1240), f(false, 1260)], 1210, [], false)).toMatchObject({ open: [] });
  });
});

describe("openObjectives", () => {
  it("waits for first spawns and respawn timers", () => {
    expect(openObjectives([], 200)).toEqual([]);
    expect(openObjectives([], 400)).toEqual(["dragon"]);
    expect(openObjectives([{ id: "dragon", kind: "dragon", at: 1500, ours: null }], 1300)).toEqual(["baron"]);
    expect(openObjectives([{ id: "baron", kind: "baron", at: 1250, ours: null }], 1300)).toEqual(["baron", "dragon"]);
  });
});
