import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { coverage } from "./coverage.ts";
import { rollup } from "./rollup.ts";
import { fakeD1 } from "./test/fakeD1.ts";

describe("dropped games", () => {
  it("are counted in coverage and left out of games, picks and bans denominators", async () => {
    const { db, sqlite } = fakeD1();
    const game = sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group, dropped) VALUES (?, '16.21', 1000, 420, '238', 'emerald', ?)");
    for (let i = 0; i < 8; i++) game.run(`EUW1_ok${i}`, null);
    game.run("EUW1_remake", "surrender");
    game.run("EUW1_left1", "afk");
    game.run("EUW1_left2", "afk");
    await rollup(db, async () => emptyCatalog());

    const report = await coverage(db);
    expect(report.dropped).toEqual([
      { patch: "16.21", queue: 420, reason: "afk", games: 2 },
      { patch: "16.21", queue: 420, reason: "surrender", games: 1 },
    ]);
    expect(report.games).toEqual([{ patch: "16.21", queue: 420, games: 8 }]);
    expect(report.brackets?.[0].games).toBe(8);
    // Bans and picks are rated against the eight counted games, not eleven.
    const { results } = await db.prepare("SELECT SUM(games) AS games FROM stat_counts_g WHERE kind = 'pool-games'").all<{ games: number }>();
    expect(results[0].games).toBe(8);
  });
});
