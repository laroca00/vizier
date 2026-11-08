import { describe, expect, it } from "vitest";
import type { PoolPick } from "./personal";
import { enteredQueueFlow, planPreload } from "./preload";

const pick = (championId: number, position: string | null, rank: PoolPick["rank"] = "main"): PoolPick => ({ championId, position, rank, note: "", buildId: null });

describe("lobby preload", () => {
  it("fetches all five roles without a pool", () => {
    expect(planPreload([]).roles).toHaveLength(5);
  });

  it("fetches the pool's roles once each", () => {
    expect(planPreload([pick(1, "MIDDLE"), pick(2, "MIDDLE"), pick(3, "TOP"), pick(4, null)]).roles).toEqual(["MIDDLE", "TOP"]);
  });

  it("puts main picks first, drops repeats and stops at six builds", () => {
    const pool = [pick(1, "TOP", "secondary"), pick(1, "TOP", "secondary"), ...[2, 3, 4, 5, 6, 7, 8].map((id) => pick(id, "MIDDLE"))];
    const { builds } = planPreload(pool);
    expect(builds).toHaveLength(6);
    expect(builds[0].championId).toBe(2);
    expect(builds.filter((b) => b.championId === 1)).toHaveLength(0);
  });

  it("starts when the queue flow begins, not between its steps", () => {
    expect(enteredQueueFlow(null, "Lobby")).toBe(true);
    expect(enteredQueueFlow("None", "Matchmaking")).toBe(true);
    expect(enteredQueueFlow("Lobby", "Matchmaking")).toBe(false);
    expect(enteredQueueFlow("Matchmaking", "ReadyCheck")).toBe(false);
    expect(enteredQueueFlow("Lobby", "ChampSelect")).toBe(false);
  });
});
