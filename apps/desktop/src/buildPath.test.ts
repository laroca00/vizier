import { describe, expect, it } from "vitest";
import { buildPath } from "./buildPath";

const picks = {
  startItems: { ids: [1055, 2003], games: 80, winRate: 0.52 },
  coreItems: { ids: [3031, 3036, 3094], games: 40, winRate: 0.55 },
  items: [3031, 3036, 3006, 3094, 3072, 3046, 1038].map((id, i) => ({ id, games: 100 - i * 10, winRate: 0.5 })),
};
const finished = (id: number) => id !== 1038;

describe("buildPath", () => {
  it("runs from the start through the core to the next most bought items", () => {
    const steps = buildPath(picks, finished);
    expect(steps.map((s) => s.key)).toEqual(["start", "core", "later"]);
    expect(steps[1].items.map((i) => i.id)).toEqual([3031, 3036, 3094]);
    expect(steps[2].items.map((i) => i.id)).toEqual([3006, 3072, 3046]);
    expect(steps[2].winRate).toBeNull();
  });
  it("carries games and win rate on the combination steps", () => {
    const [start, core] = buildPath(picks, finished);
    expect([start.games, start.winRate, core.games, core.winRate]).toEqual([80, 0.52, 40, 0.55]);
  });
  it("skips steps without data", () => {
    expect(buildPath({ startItems: null, coreItems: null, items: [] }, finished)).toEqual([]);
  });
});
