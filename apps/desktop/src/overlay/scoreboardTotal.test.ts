import { describe, expect, it } from "vitest";
import { itemDifference, scoreboardRows } from "./live";
import { sampleGame } from "./sample";

const gold = (id: number) => id % 1000;

describe("scoreboard total", () => {
  it("equals the sum of the lane pairs when every role is filled", () => {
    const game = sampleGame();
    const rows = scoreboardRows(game, gold);
    const sum = rows.reduce((total, row) => total + (row.diff ?? 0), 0);
    expect(itemDifference(game, gold)?.team).toBe(sum);
  });
});
