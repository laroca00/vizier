import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Match } from "./riot/types.ts";
import { D1Store } from "./store.ts";

// Just enough of D1's API over node:sqlite to run the real migration and queries.
function fakeD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(join(import.meta.dirname, "../migrations/0001_init.sql"), "utf8"));
  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...(params as never[])) ?? null,
    run: async () => sqlite.prepare(sql).run(...(params as never[])),
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: { run(): Promise<unknown> }[]) => {
      sqlite.exec("BEGIN");
      for (const s of statements) await s.run();
      sqlite.exec("COMMIT");
    },
  };
  return { db: db as unknown as D1Database, sqlite };
}

const match: Match = {
  metadata: { matchId: "TR1_42", participants: ["a", "b"] },
  info: {
    gameVersion: "26.21.715.1234",
    queueId: 420,
    gameStartTimestamp: 1_790_000_000_000,
    gameDuration: 1800,
    participants: [
      { puuid: "a", championId: 103, teamPosition: "MIDDLE", win: true },
      { puuid: "b", championId: 64, teamPosition: "JUNGLE", win: false },
    ],
  },
};

describe("D1Store", () => {
  it("stores a match once with its participants", async () => {
    const { db, sqlite } = fakeD1();
    const store = new D1Store(db);
    await store.putMatch(match);
    await store.putMatch(match);

    expect(await store.getMatch("TR1_42")).toEqual(match);
    expect(sqlite.prepare("SELECT patch, queue_id FROM matches").all()).toEqual([{ patch: "26.21", queue_id: 420 }]);
    expect(sqlite.prepare("SELECT puuid, champion_id, win FROM match_participants ORDER BY puuid").all()).toEqual([
      { puuid: "a", champion_id: 103, win: 1 },
      { puuid: "b", champion_id: 64, win: 0 },
    ]);
  });

  it("expires cached values", async () => {
    let now = 1000;
    const { db, sqlite } = fakeD1();
    const store = new D1Store(db, () => now);
    await store.putCached("k", { v: 1 }, 500);
    expect(await store.getCached("k")).toEqual({ v: 1 });
    now = 1500;
    expect(await store.getCached("k")).toBeUndefined();
    await store.purgeExpired();
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM cache").get()).toEqual({ n: 0 });
  });

  it("keeps a cached null, so a known 404 is not refetched", async () => {
    const { db } = fakeD1();
    const store = new D1Store(db);
    await store.putCached("missing", null, 60_000);
    expect(await store.getCached("missing")).toBeNull();
  });
});
