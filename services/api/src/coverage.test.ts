import { describe, expect, it } from "vitest";
import { coverage } from "./coverage.ts";
import { createApp } from "./app.ts";
import { MemoryStore } from "./store.ts";
import { fakeD1 } from "./test/fakeD1.ts";

async function seeded() {
  const { db } = fakeD1();
  await db.batch([
    db.prepare("INSERT INTO stat_matches (patch, queue_id, games, last_start) VALUES ('16.21', 420, 120, 50), ('16.20', 420, 80, 10)"),
    db.prepare("INSERT INTO stat_counts (patch, queue_id, team_position, champion_id, kind, value, games, wins) VALUES ('16.21', 420, 'MIDDLE', 103, 'games', '', 100, 50)"),
    db.prepare("INSERT INTO stat_counts (patch, queue_id, team_position, champion_id, kind, value, games, wins) VALUES ('16.21', 420, 'MIDDLE', 103, 'skill', '132|123', 25, 10)"),
    db.prepare("INSERT INTO crawl_players (puuid, tier, region) VALUES ('a', 'EMERALD', 'europe'), ('b', 'EMERALD', 'europe')"),
  ]);
  return db;
}

describe("coverage", () => {
  it("counts games, timeline share and followed players", async () => {
    const result = await coverage(await seeded());
    expect(result.patches).toEqual(["16.21", "16.20"]);
    expect(result.games[0]).toEqual({ patch: "16.21", queue: 420, games: 120 });
    expect(result.timeline).toEqual([{ patch: "16.21", queue: 420, players: 100, withTimeline: 25, share: 0.25 }]);
    expect(result.players).toEqual([{ region: "europe", source: "ladder", players: 2 }]);
  });

  it("sums tier groups into brackets per platform and keeps the old fields", async () => {
    const { db, sqlite } = fakeD1();
    sqlite.prepare("INSERT INTO stat_matches (patch, queue_id, games, last_start) VALUES ('16.21', 420, 100, 50)").run();
    const put = sqlite.prepare("INSERT INTO stat_counts_g (rank_group, patch, queue_id, team_position, champion_id, kind, value, games, wins) VALUES (?, '16.21', 420, ?, ?, ?, ?, ?, 0)");
    for (const [group, platform, games] of [["silver", "EUW1", 30], ["gold", "TR1", 20], ["emerald", "EUW1", 10], ["master_plus", "KR", 5]] as const) put.run(group, "", 0, "matches", platform, games);
    put.run("silver", "MIDDLE", 103, "games", "", 300);
    put.run("silver", "MIDDLE", 103, "skill", "x", 60);
    put.run("diamond", "MIDDLE", 103, "games", "", 100);
    put.run("diamond", "MIDDLE", 103, "skill", "x", 90);
    const result = await coverage(db);
    const games = (bracket: string, platform: string) => result.brackets?.find((b) => b.bracket === bracket && b.platform === platform)?.games;
    expect(games("all", "EUW1")).toBe(40);
    expect(games("gold_minus", "EUW1")).toBe(30);
    expect(games("gold_minus", "TR1")).toBe(20);
    expect(games("emerald_plus", "EUW1")).toBe(10);
    expect(games("emerald_plus", "KR")).toBe(5);
    expect(games("master_plus", "KR")).toBe(5);
    expect(games("diamond_plus", "EUW1")).toBeUndefined();
    const share = (bracket: string) => result.timelineBrackets?.find((b) => b.bracket === bracket)?.share;
    expect(share("gold_minus")).toBe(0.2);
    expect(share("diamond_plus")).toBe(0.9);
    expect(share("all")).toBe(0.375);
  });

  it("counts mode games per day and mode players per tier group", async () => {
    const { db, sqlite } = fakeD1();
    const day = (n: number) => Date.now() - n * 86_400_000;
    const put = sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, dropped) VALUES (?, '16.21', ?, ?, ?)");
    put.run("a", day(0), 450, null);
    put.run("b", day(0), 450, null);
    put.run("c", day(1), 1700, null);
    put.run("d", day(1), 450, "remake");
    put.run("e", day(3), 420, null);
    put.run("f", day(40), 450, null);
    const players = sqlite.prepare("INSERT INTO mode_players (puuid, region, queue_id, added_at, rank_group) VALUES (?, 'asia', 450, 1, ?)");
    players.run("p1", "silver");
    players.run("p2", "silver");
    players.run("p3", null);
    const result = await coverage(db);
    const today = new Date(day(0)).toISOString().slice(0, 10);
    expect(result.modeDays?.find((r) => r.day === today && r.queue === 450)?.games).toBe(2);
    expect(result.modeDays?.filter((r) => r.queue === 1700)).toHaveLength(1);
    // Ranked, dropped and old games stay out.
    expect(result.modeDays?.reduce((sum, r) => sum + r.games, 0)).toBe(3);
    expect(result.modeGroups).toEqual(expect.arrayContaining([{ group: "silver", players: 2 }, { group: null, players: 1 }]));
  });

  it("is served from the published doc, empty before the first publish", async () => {
    const app = createApp(new MemoryStore(), { statsDb: await seeded() });
    expect(await (await app.request("/v1/meta/coverage")).json()).toEqual({ patches: [], games: [], timeline: [], players: [] });
  });
});
