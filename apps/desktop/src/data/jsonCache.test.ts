import { describe, expect, it, vi } from "vitest";
import { cachedJson, memoryStore, sweepOldVersions } from "./jsonCache";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("cachedJson", () => {
  it("loads once per version and path, then reads the store", async () => {
    const store = memoryStore();
    const load = vi.fn(async () => '{"a":1}');
    expect(await cachedJson(store, "16.21.1", "tr_TR/item.json", load)).toEqual({ a: 1 });
    await tick();
    expect(await cachedJson(store, "16.21.1", "tr_TR/item.json", load)).toEqual({ a: 1 });
    expect(load).toHaveBeenCalledTimes(1);
    await cachedJson(store, "16.22.1", "tr_TR/item.json", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("drops files of older versions", async () => {
    const store = memoryStore();
    await store.set("16.20.1/a", "{}");
    await store.set("16.21.1/b", "{}");
    await sweepOldVersions(store, "16.21.1");
    expect(await store.keys()).toEqual(["16.21.1/b"]);
  });

  it("still answers when the store is missing or broken", async () => {
    expect(await cachedJson(null, "v", "p", async () => "[1]")).toEqual([1]);
    const broken = { ...memoryStore(), get: async () => { throw new Error("denied"); }, set: async () => { throw new Error("denied"); } };
    expect(await cachedJson(broken, "v", "p", async () => "[2]")).toEqual([2]);
  });
});
