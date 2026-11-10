import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { championHistory, recordHistory, tierHistory } from "./history.ts";
import { rollup } from "./rollup.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const RUNES = "8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011";

function games(sqlite: ReturnType<typeof fakeD1>["sqlite"], from: number, count: number, group: string, wins: number) {
  for (let i = from; i < from + count; i++) {
    const id = `EUW1_${group}_${i}`;
    sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '238', ?)").run(id, group);
    const row = sqlite.prepare(
      `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, duration, queue_id, team_id, rank_group)
       VALUES (?, '16.21', ?, 'MIDDLE', ?, ?, '4,14', '1', 1800, 420, ?, ?)`,
    );
    row.run(id, 103, i - from < wins ? 1 : 0, RUNES, 100, group);
    row.run(id, 64, i - from < wins ? 0 : 1, RUNES, 200, group);
  }
}

const day = (n: number) => Date.UTC(2026, 10, n, 12);

describe("daily history", () => {
  it("records one row a day per bracket with the patch's total so far, and not twice on the same day", async () => {
    const { db, sqlite } = fakeD1();
    games(sqlite, 0, 20, "emerald", 12);
    games(sqlite, 0, 10, "gold", 3);
    await rollup(db, async () => emptyCatalog());
    const first = await recordHistory(db, day(1));
    expect(first).toBeGreaterThan(0);
    expect(await recordHistory(db, day(1) + 3600_000)).toBe(0);

    games(sqlite, 20, 20, "emerald", 4);
    await rollup(db, async () => emptyCatalog());
    await recordHistory(db, day(2));

    const history = await championHistory(db, 103);
    const emerald = history?.roles.MIDDLE?.emerald_plus?.["16.21"];
    // 20 games at 60%, then 40 games and 16 wins; pick rate is out of all matches, ban rate of champion 238 is separate.
    expect(emerald).toEqual([
      ["2026-11-01", 20, 0.6, 1, 0],
      ["2026-11-02", 40, 0.4, 1, 0],
    ]);
    expect(history?.roles.MIDDLE?.gold_minus?.["16.21"]?.[0]).toEqual(["2026-11-01", 10, 0.3, 1, 0]);
    // "All" adds the gold games to the emerald ones.
    expect(history?.roles.MIDDLE?.all?.["16.21"]?.[1]?.[1]).toBe(50);
  });

  it("lines up the tier doc by day", async () => {
    const { db, sqlite } = fakeD1();
    games(sqlite, 0, 20, "emerald", 10);
    await rollup(db, async () => emptyCatalog());
    await recordHistory(db, day(1));
    games(sqlite, 20, 10, "emerald", 7);
    await rollup(db, async () => emptyCatalog());
    await recordHistory(db, day(3));
    const tier = await tierHistory(db, "MIDDLE");
    expect(tier?.days).toEqual(["2026-11-01", "2026-11-03"]);
    expect(tier?.champions[103]).toEqual({ games: [20, 30], winRate: [0.5, 0.567] });
  });

  it("returns null for a champion without history", async () => {
    const { db } = fakeD1();
    expect(await championHistory(db, 1)).toBeNull();
  });
});

describe("history routes", () => {
  it("serve the docs and empty answers, and reject bad input", async () => {
    const { createApp } = await import("./app.ts");
    const { MemoryStore } = await import("./store.ts");
    const { docKey } = await import("./statDocs.ts");
    const { db } = fakeD1();
    await db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES (?, ?, 5)").bind(docKey.history(103), JSON.stringify({ fields: [], roles: { MIDDLE: {} } })).run();
    const app = createApp(new MemoryStore(), { statsDb: db });
    expect(await (await app.request("/v1/history/103")).json()).toMatchObject({ roles: { MIDDLE: {} } });
    expect(await (await app.request("/v1/history/5")).json()).toEqual({ fields: [], roles: {} });
    expect((await app.request("/v1/history/abc")).status).toBe(400);
    expect(await (await app.request("/v1/history/tier/middle")).json()).toMatchObject({ days: [] });
    expect((await app.request("/v1/history/tier/nowhere")).status).toBe(400);
  });
});
