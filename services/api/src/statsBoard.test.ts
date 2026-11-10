import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { createApp } from "./app.ts";
import { rollup } from "./rollup.ts";
import { statsBoard } from "./stats.ts";
import { MemoryStore } from "./store.ts";
import { docKey } from "./statDocs.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const RUNES = "8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011";

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, group: string, mine: Record<string, number | null>) {
  sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', ?)").run(id, group);
  const row = sqlite.prepare(
    `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, duration, queue_id, team_id, rank_group, kills, assists, deaths, cs_pm)
     VALUES (?, '16.21', ?, 'MIDDLE', 1, ?, '4,14', '1', ?, 420, ?, ?, ?, ?, ?, ?)`,
  );
  row.run(id, 103, RUNES, 1800, 100, group, mine.kills, mine.assists, mine.deaths, mine.cs_pm);
  row.run(id, 64, RUNES, 1800, 200, group, 1, 1, 1, 5);
}

describe("stats board", () => {
  it("averages kills, deaths, assists, farm and length per champion and role, by bracket", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 25; i++) game(sqlite, `EUW1_e${i}`, "emerald", { kills: 8, assists: 4, deaths: 4, cs_pm: 8 });
    for (let i = 0; i < 25; i++) game(sqlite, `EUW1_g${i}`, "gold", { kills: 4, assists: 4, deaths: 8, cs_pm: 6 });
    // Games from before the stats were kept do not dilute the average.
    for (let i = 0; i < 30; i++) game(sqlite, `EUW1_o${i}`, "emerald", { kills: null, assists: null, deaths: null, cs_pm: null });
    await rollup(db, async () => emptyCatalog());

    const emerald = (await statsBoard(db, "MIDDLE", "emerald_plus")).rows.find((r) => r.championId === 103);
    expect(emerald).toMatchObject({ games: 25, kills: 8, deaths: 4, assists: 4, kda: 3, csPerMinute: 8, minutes: 30, goldDiff15: null, late: null });
    const gold = (await statsBoard(db, "MIDDLE", "gold_minus")).rows.find((r) => r.championId === 103);
    expect(gold).toMatchObject({ games: 25, kda: 1, csPerMinute: 6 });
    const all = (await statsBoard(db, "MIDDLE", "all")).rows.find((r) => r.championId === 103);
    expect(all?.games).toBe(50);
  });

  it("leaves out champions with a thin sample and is served by its route", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 5; i++) game(sqlite, `EUW1_t${i}`, "emerald", { kills: 8, assists: 4, deaths: 4, cs_pm: 8 });
    await rollup(db, async () => emptyCatalog());
    expect((await statsBoard(db, "MIDDLE")).rows).toEqual([]);

    await db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES (?, ?, 5)").bind(docKey.statsBoard("MIDDLE"), JSON.stringify({ patches: ["16.21"], rows: [{ championId: 103 }] })).run();
    const app = createApp(new MemoryStore(), { statsDb: db });
    expect(await (await app.request("/v1/stats/board/middle")).json()).toMatchObject({ rows: [{ championId: 103 }], rank: "emerald_plus" });
    expect(await (await app.request("/v1/stats/board/top?rank=gold_minus")).json()).toMatchObject({ rows: [], rank: "gold_minus" });
    expect((await app.request("/v1/stats/board/nowhere")).status).toBe(400);
  });
});

describe("stats board, late games", () => {
  it("adds the win rate of games from 35 minutes on when there are enough", async () => {
    const { db, sqlite } = fakeD1();
    for (let i = 0; i < 25; i++) game(sqlite, `EUW1_l${i}`, "emerald", { kills: 8, assists: 4, deaths: 4, cs_pm: 8 });
    sqlite.prepare("UPDATE participant_stats SET duration = 2400, win = CASE WHEN rowid % 4 = 0 THEN 0 ELSE 1 END").run();
    await rollup(db, async () => emptyCatalog());
    const row = (await statsBoard(db, "MIDDLE")).rows.find((r) => r.championId === 103);
    expect(row?.late?.games).toBe(25);
    expect(row?.late?.winRate).toBeGreaterThan(0.5);
    expect(row?.minutes).toBe(40);
  });
});
