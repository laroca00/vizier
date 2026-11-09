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

  it("is served from the published doc, empty before the first publish", async () => {
    const app = createApp(new MemoryStore(), { statsDb: await seeded() });
    expect(await (await app.request("/v1/meta/coverage")).json()).toEqual({ patches: [], games: [], timeline: [], players: [] });
  });
});
