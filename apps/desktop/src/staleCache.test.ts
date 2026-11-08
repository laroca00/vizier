import { describe, expect, it } from "vitest";
import { createStaleCache } from "./staleCache";

describe("createStaleCache", () => {
  it("returns a value until it is too old", () => {
    let t = 0;
    const cache = createStaleCache(1000, () => t);
    cache.set("a", 1);
    t = 999;
    expect(cache.get("a")).toBe(1);
    t = 1001;
    expect(cache.get("a")).toBeUndefined();
  });

  it("drops the oldest entry past the limit", () => {
    const cache = createStaleCache(1000, () => 0, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });
});
