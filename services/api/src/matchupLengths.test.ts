import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { rollup } from "./rollup.ts";
import { counters, sampleLimits } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const RUNES = "8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011";

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, seconds: number, win: boolean, group = "emerald") {
  sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', ?)").run(id, group);
  const row = sqlite.prepare(
    `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group)
     VALUES (?, '16.21', ?, 'MIDDLE', ?, ?, '4,14', '1', ?, ?, 420, ?, ?)`,
  );
  row.run(id, 103, win ? 1 : 0, RUNES, 238, seconds, 100, group);
  row.run(id, 238, win ? 0 : 1, RUNES, 103, seconds, 200, group);
}

describe("matchup win rate by game length", () => {
  it("is rolled up per opponent and bucket and lands on the counters doc", async () => {
    Object.assign(sampleLimits, { pairGames: 10 });
    const { db, sqlite } = fakeD1();
    // Ahri against Zed: loses short games (2 of 12), wins long ones (10 of 12).
    for (let i = 0; i < 12; i++) game(sqlite, `EUW1_s${i}`, 1100, i < 2);
    for (let i = 0; i < 12; i++) game(sqlite, `EUW1_l${i}`, 2300, i < 10);
    for (let i = 0; i < 12; i++) game(sqlite, `EUW1_g${i}`, 2300, false, "gold");
    await rollup(db, async () => emptyCatalog());

    const emerald = (await counters(db, 103, "MIDDLE", "emerald_plus")).matchups.find((m) => m.championId === 238);
    expect(emerald?.lengths).toEqual([
      { bucket: 0, games: 12, winRate: 0.167 },
      { bucket: 4, games: 12, winRate: 0.833 },
    ]);
    const gold = (await counters(db, 103, "MIDDLE", "gold_minus")).matchups.find((m) => m.championId === 238);
    expect(gold?.lengths).toEqual([{ bucket: 4, games: 12, winRate: 0 }]);
  });
});
