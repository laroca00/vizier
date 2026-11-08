import { describe, expect, it, vi } from "vitest";
import { cacheKey, createApiCache, ttlFor, type CacheStore } from "./apiCache";

function fakeStorage(): CacheStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("ttlFor", () => {
  it("uses 30 minutes for tier lists and builds, 5 for pro builds", () => {
    expect(ttlFor("/v1/tierlist/MIDDLE")).toBe(30 * 60_000);
    expect(ttlFor("/v1/builds/103?position=MIDDLE")).toBe(30 * 60_000);
    expect(ttlFor("/v1/pros/builds?patch=15.1")).toBe(5 * 60_000);
  });
});

describe("cacheKey", () => {
  it("keeps the query in the key", () => {
    expect(cacheKey("/v1/builds/1?vs=2")).not.toBe(cacheKey("/v1/builds/1"));
  });
});

describe("createApiCache", () => {
  it("serves from cache until the ttl passes", async () => {
    let t = 0;
    const cache = createApiCache(fakeStorage(), () => t);
    const load = vi.fn().mockResolvedValue({ n: 1 });
    await cache.get("/v1/tierlist/TOP", load);
    t = 29 * 60_000;
    await cache.get("/v1/tierlist/TOP", load);
    expect(load).toHaveBeenCalledTimes(1);
    t = 31 * 60_000;
    await cache.get("/v1/tierlist/TOP", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("expires pro builds sooner", async () => {
    let t = 0;
    const cache = createApiCache(null, () => t);
    const load = vi.fn().mockResolvedValue([]);
    await cache.get("/v1/pros/builds", load);
    t = 6 * 60_000;
    await cache.get("/v1/pros/builds", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reads what a previous session stored", async () => {
    const storage = fakeStorage();
    await createApiCache(storage, () => 0).get("/v1/bans", async () => ({ a: 1 }));
    const load = vi.fn();
    const value = await createApiCache(storage, () => 1000).get("/v1/bans", load);
    expect(value).toEqual({ a: 1 });
    expect(load).not.toHaveBeenCalled();
  });

  it("shares one in-flight request and does not cache failures", async () => {
    const cache = createApiCache(null);
    const load = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(1);
    const [a, b] = await Promise.allSettled([cache.get("/v1/bans", load), cache.get("/v1/bans", load)]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("rejected");
    expect(load).toHaveBeenCalledTimes(1);
    expect(await cache.get("/v1/bans", load)).toBe(1);
  });

  it("survives broken storage", async () => {
    const broken: CacheStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(await createApiCache(broken).get("/v1/bans", async () => 5)).toBe(5);
  });
});
