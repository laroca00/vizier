import { describe, expect, it } from "vitest";
import type { LiveGame } from "./live";
import { sampleGame } from "./sample";
import { newSpikes, shownSpikes, SPIKE_SECONDS, type Spike } from "./spikes";

const finished = (id: number) => id === 3142 || id === 3071;

function later(game: LiveGame, seconds: number, change: (g: LiveGame) => void): LiveGame {
  const next = structuredClone(game);
  next.gameTime += seconds;
  change(next);
  return next;
}

const player = (g: LiveGame, id: string) => g.players.find((p) => p.riotId === id)!;

describe("newSpikes", () => {
  const prev = sampleGame();
  const me = player(prev, "Vizier#TR1");
  const zed = player(prev, "Enemy#TR1");

  it("reports enemy ultimate levels and finished items, flagging the lane opponent", () => {
    prev.players.forEach((p) => (p.level = 5));
    const next = later(prev, 1, (g) => {
      player(g, "Enemy#TR1").level = 6;
      player(g, "Other#TR1").items.push({ itemId: 3071, count: 1 });
      // Allies and components don't count.
      player(g, "Top#TR1").level = 6;
      player(g, "Enemy1#TR1").items.push({ itemId: 1036, count: 1 });
    });
    const spikes = newSpikes(prev, next, me, zed, finished);
    expect(spikes).toEqual([
      { id: "Other#TR1:I3071", champion: "Vi", lane: false, at: next.gameTime, kind: "item", itemId: 3071 },
      { id: "Enemy#TR1:L6", champion: "Zed", lane: true, at: next.gameTime, kind: "level", level: 6 },
    ]);
  });

  it("stays quiet on the first frame and after a long gap", () => {
    const next = later(prev, 30, (g) => (player(g, "Enemy#TR1").level = 11));
    expect(newSpikes(null, next, me, zed, finished)).toEqual([]);
    expect(newSpikes(prev, next, me, zed, finished)).toEqual([]);
  });
});

describe("shownSpikes", () => {
  const s = (id: string, at: number, lane = false): Spike => ({ id, champion: "X", lane, at, kind: "level", level: 6 });

  it("keeps fresh notices, lane opponent first, at most four", () => {
    const list = [s("a", 100), s("b", 105, true), s("c", 106), s("d", 107), s("e", 108), s("old", 100 - SPIKE_SECONDS)];
    expect(shownSpikes(list, 109).map((x) => x.id)).toEqual(["b", "e", "d", "c"]);
  });
});
