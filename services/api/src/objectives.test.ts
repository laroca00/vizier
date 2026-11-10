import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { firstObjectives } from "./crawler.ts";
import { rollup } from "./rollup.ts";
import { championOverview, sampleLimits } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10 }));

describe("firstObjectives", () => {
  it("lists the letters of the objectives a team took first", () => {
    const first = { first: true, kills: 1 };
    const none = { first: false, kills: 0 };
    expect(firstObjectives({ objectives: { dragon: first, horde: none, riftHerald: first, tower: first, champion: none } })).toBe("dht");
    expect(firstObjectives({ objectives: { dragon: none } })).toBe("");
  });
  it("is null when the match has no objective data", () => {
    expect(firstObjectives(undefined)).toBeNull();
    expect(firstObjectives({})).toBeNull();
  });
});

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, champion: number, objectives: string | null, win: boolean) {
  sqlite.prepare("INSERT OR IGNORE INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', 'emerald')").run(id);
  sqlite
    .prepare(
      `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group, objectives)
       VALUES (?, '16.21', ?, 'JUNGLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,11', '3157', 11, 1800, 420, 100, 'emerald', ?)`,
    )
    .run(id, champion, win ? 1 : 0, objectives);
}

describe("objective rates", () => {
  it("compares a champion's first-objective rate with its role's", async () => {
    const { db, sqlite } = fakeD1();
    // Champion 64: 40 games, first dragon in 30 (24 wins), first tower in 10. Champion 200: 40 games, first dragon in 10.
    for (let i = 0; i < 40; i++) game(sqlite, `TR1_a${i}`, 64, `${i < 30 ? "d" : ""}${i < 10 ? "t" : ""}`, i < 24);
    for (let i = 0; i < 40; i++) game(sqlite, `TR1_b${i}`, 200, i < 10 ? "d" : "", i < 20);
    await rollup(db, async () => emptyCatalog());

    const objectives = (await championOverview(db, 64, "JUNGLE", 420, "emerald_plus"))?.objectives;
    expect(objectives?.games).toBe(40);
    expect(objectives?.rates.find((r) => r.key === "d")).toEqual({ key: "d", games: 30, rate: 0.75, winRate: 0.8, roleRate: 0.5 });
    expect(objectives?.rates.find((r) => r.key === "t")).toMatchObject({ games: 10, rate: 0.25, roleRate: 0.125 });
    // Nobody took herald or grubs first, so there is no role rate to compare with.
    expect(objectives?.rates.map((r) => r.key)).toEqual(["d", "t"]);
  });

  it("is left out below the minimum games or without objective data", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 12; i++) game(sqlite, `TR1_${i}`, 64, i < 5 ? "d" : null, true);
    await rollup(db, async () => emptyCatalog());
    expect((await championOverview(db, 64, "JUNGLE", 420, "emerald_plus"))?.objectives).toBeUndefined();
  });
});
