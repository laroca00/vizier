import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { aggregateBuild } from "./builds.ts";
import { MAIN_GAMES, rollup } from "./rollup.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const RUNES = "8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011";

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, key: string | null, win: boolean, items: string) {
  sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', 'emerald')").run(id);
  sqlite
    .prepare(
      `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, duration, queue_id, team_id, rank_group, player_key)
       VALUES (?, '16.21', 103, 'MIDDLE', ?, ?, '4,14', ?, 1800, 420, 100, 'emerald', ?)`,
    )
    .run(id, win ? 1 : 0, RUNES, items, key);
}

describe("builds of frequent players", () => {
  it("counts a game once its player has MAIN_GAMES on the champion, and only then shows the build", async () => {
    const { db, sqlite } = fakeD1();
    // One player plays 60 games (items 1); fifty others play one game each (items 2).
    for (let i = 0; i < 60; i++) game(sqlite, `EUW1_m${i}`, "aaaaaaaaaaaa", i % 2 === 0, "1");
    for (let i = 0; i < 50; i++) game(sqlite, `EUW1_o${i}`, `k${i}`.padEnd(12, "0"), false, "2");
    await rollup(db, async () => emptyCatalog());

    const build = await aggregateBuild(db, 103, "MIDDLE");
    expect(build?.games).toBe(110);
    // Games 5 to 60 of the frequent player count.
    expect(build?.mains?.games).toBe(60 - MAIN_GAMES + 1);
    expect(build?.mains?.items.map((i) => i.id)).toEqual([1]);
    expect(build?.mains?.runes[0].games).toBe(56);
  });

  it("keeps running counts across rollups and leaves the field out when thin", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 3; i++) game(sqlite, `EUW1_a${i}`, "bbbbbbbbbbbb", true, "1");
    await rollup(db, async () => emptyCatalog());
    for (let i = 3; i < 8; i++) game(sqlite, `EUW1_a${i}`, "bbbbbbbbbbbb", true, "1");
    await rollup(db, async () => emptyCatalog());
    const counts = sqlite.prepare("SELECT games FROM stat_counts_g WHERE kind = 'm-games'").all() as { games: number }[];
    expect(counts.map((c) => c.games)).toEqual([4]);
    expect((await aggregateBuild(db, 103, "MIDDLE"))?.mains).toBeUndefined();
  });

  it("ignores games without a player key", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 20; i++) game(sqlite, `EUW1_n${i}`, null, true, "1");
    await rollup(db, async () => emptyCatalog());
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM stat_counts_g WHERE kind = 'm-games'").get()).toEqual({ n: 0 });
  });
});
