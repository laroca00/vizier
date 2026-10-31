import { describe, expect, it } from "vitest";
import type { Match } from "./riot/types.ts";
import { D1Store } from "./store.ts";
import { fakeD1 } from "./test/fakeD1.ts";

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

  it("stores a value cached for good with a finite expiry", async () => {
    const { db, sqlite } = fakeD1();
    await new D1Store(db).putCached("forever", 1, Infinity);
    const row = sqlite.prepare("SELECT expires_at FROM cache WHERE key = 'forever'").get() as { expires_at: number };
    expect(Number.isFinite(row.expires_at)).toBe(true);
  });

  it("keeps a cached null, so a known 404 is not refetched", async () => {
    const { db } = fakeD1();
    const store = new D1Store(db);
    await store.putCached("missing", null, 60_000);
    expect(await store.getCached("missing")).toBeNull();
  });
});
