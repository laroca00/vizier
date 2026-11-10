import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { rollup } from "./rollup.ts";
import { championOverview, sampleLimits } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10 }));

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, route: string | null, win: boolean) {
  sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', 'emerald')").run(id);
  sqlite
    .prepare(
      `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group, jungle_path)
       VALUES (?, '16.21', 64, 'JUNGLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,11', '3157', 11, 1800, 420, 100, 'emerald', ?)`,
    )
    .run(id, win ? 1 : 0, route);
}

describe("jungle routes", () => {
  it("sums paths and the median gank minute onto the jungle overview", async () => {
    const { db, sqlite } = fakeD1();
    // 20 top-side games starting top lane (14 wins), ganks at 3, 4, 4, 5; 10 bot-side games that never ganked.
    for (let i = 0; i < 20; i++) game(sqlite, `TR1_t${i}`, `top|top|${[3, 4, 4, 5][i % 4]}`, i < 14);
    for (let i = 0; i < 10; i++) game(sqlite, `TR1_b${i}`, "bot|none|", i < 4);
    await rollup(db, async () => emptyCatalog());

    const overview = await championOverview(db, 64, "JUNGLE", 420, "emerald_plus");
    expect(overview?.jungle?.games).toBe(30);
    expect(overview?.jungle?.paths).toEqual([
      { side: "top", lane: "top", games: 20, winRate: 0.7 },
      { side: "bot", lane: "none", games: 10, winRate: 0.4 },
    ]);
    expect(overview?.jungle?.gank).toEqual({ games: 20, medianMinute: 4 });
  });

  it("is left out below the minimum games and for rows without a route", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 12; i++) game(sqlite, `TR1_${i}`, i < 5 ? "top|mid|4" : null, true);
    await rollup(db, async () => emptyCatalog());
    expect((await championOverview(db, 64, "JUNGLE", 420, "emerald_plus"))?.jungle).toBeUndefined();
  });
});
