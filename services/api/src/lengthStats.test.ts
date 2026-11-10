import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { LENGTH_BUCKET_MINUTES, lengthBucket, rollup } from "./rollup.ts";
import { championOverview, sampleLimits } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10 }));

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, seconds: number, win: boolean, group = "emerald") {
  sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', ?)").run(id, group);
  const row = sqlite.prepare(
    `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group)
     VALUES (?, '16.21', ?, 'MIDDLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,14', '3157', ?, ?, 420, ?, ?)`,
  );
  row.run(id, 103, win ? 1 : 0, 64, seconds, 100, group);
  row.run(id, 64, win ? 0 : 1, 103, seconds, 200, group);
}

describe("lengthBucket", () => {
  it("cuts at 20, 25, 30 and 35 minutes", () => {
    expect(LENGTH_BUCKET_MINUTES).toEqual([20, 25, 30, 35]);
    expect([1199, 1200, 1499, 1500, 1800, 2099, 2100, 4000].map(lengthBucket)).toEqual([0, 1, 1, 2, 3, 3, 4, 4]);
  });
});

describe("win rate by game length", () => {
  it("is rolled up per bucket and bracket and lands on the champion overview", async () => {
    const { db, sqlite } = fakeD1();
    // Ahri: 10 games at 22 minutes (7 wins), 10 at 40 minutes (3 wins) in emerald; 10 more at 22 minutes (all lost) in gold.
    for (let i = 0; i < 10; i++) game(sqlite, `TR1_a${i}`, 1320, i < 7);
    for (let i = 0; i < 10; i++) game(sqlite, `TR1_b${i}`, 2400, i < 3);
    for (let i = 0; i < 10; i++) game(sqlite, `TR1_c${i}`, 1320, false, "gold");
    await rollup(db, async () => emptyCatalog());

    const emerald = await championOverview(db, 103, "MIDDLE", 420, "emerald_plus");
    expect(emerald?.lengths).toEqual([
      { bucket: 1, games: 10, winRate: 0.7 },
      { bucket: 4, games: 10, winRate: 0.3 },
    ]);
    const lower = await championOverview(db, 103, "MIDDLE", 420, "gold_minus");
    expect(lower?.lengths).toEqual([{ bucket: 1, games: 10, winRate: 0 }]);
  });

  it("leaves the field out when no game carried a length", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 12; i++) game(sqlite, `TR1_${i}`, 0, true);
    sqlite.prepare("UPDATE participant_stats SET duration = NULL").run();
    await rollup(db, async () => emptyCatalog());
    expect((await championOverview(db, 103, "MIDDLE", 420, "emerald_plus"))?.lengths).toBeUndefined();
  });
});
