import { describe, expect, it } from "vitest";
import { enemyForSlot, flashCooldown, flashTimers, READY_LINGER } from "./flash";
import { sampleGame } from "./sample";

describe("enemyForSlot", () => {
  it("maps slots to enemy roles, and to scoreboard order without roles", () => {
    const game = sampleGame();
    expect(enemyForSlot(game, "ORDER", "flash1")?.riotId).toBe("Enemy1#TR1");
    expect(enemyForSlot(game, "ORDER", "flash3")?.riotId).toBe("Enemy#TR1");
    game.players.forEach((p) => (p.position = ""));
    expect(enemyForSlot(game, "ORDER", "flash2")?.riotId).toBe("Other#TR1");
  });
});

describe("flashCooldown", () => {
  it("is five minutes, less with Ionian Boots", () => {
    const game = sampleGame();
    const zed = game.players.find((p) => p.riotId === "Enemy#TR1")!;
    zed.items = [];
    expect(flashCooldown(zed)).toBe(300);
    zed.items = [{ itemId: 3158, count: 1 }];
    expect(flashCooldown(zed)).toBeCloseTo(272.7, 1);
  });
});

describe("flashTimers", () => {
  it("counts from the press, lingers briefly when ready and skips enemies without Flash", () => {
    const game = sampleGame();
    game.players.forEach((p) => (p.items = []));
    game.players.find((p) => p.riotId === "Enemy1#TR1")!.spells = ["SummonerTeleport", "SummonerGhost"];
    game.players.find((p) => p.riotId === "Enemy#TR1")!.spells = ["SummonerFlash", "SummonerDot"];
    const timers = flashTimers({ flash1: 100, flash3: 200 }, game, "ORDER", 250);
    expect(timers).toEqual([{ slot: "flash3", champion: "Zed", backAt: 500 }]);
    expect(flashTimers({ flash3: 200 }, game, "ORDER", 500 + READY_LINGER - 1)).toHaveLength(1);
    expect(flashTimers({ flash3: 200 }, game, "ORDER", 500 + READY_LINGER)).toHaveLength(0);
  });
});
