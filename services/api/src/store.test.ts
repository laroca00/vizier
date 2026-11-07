import { describe, expect, it } from "vitest";
import { D1Store } from "./store.ts";
import { fakeD1 } from "./test/fakeD1.ts";

describe("D1Store", () => {
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

describe("D1Store writes", () => {
  it("answers even when D1 refuses the cache write", async () => {
    const refusing = {
      prepare: () => ({
        bind: () => ({ run: () => Promise.reject(new Error("D1_ERROR: daily row write limit")) }),
      }),
      batch: () => Promise.reject(new Error("D1_ERROR: daily row write limit")),
    } as unknown as D1Database;
    const store = new D1Store(refusing);
    await expect(store.putCached("k", { a: 1 }, 1000)).resolves.toBeUndefined();
  });
});
