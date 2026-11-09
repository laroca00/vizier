import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { MemoryStore } from "./store.ts";
import { fakeD1 } from "./test/fakeD1.ts";

describe("doc freshness", () => {
  it("adds updatedAt when the crawler stamped the doc, and leaves unstamped docs alone", async () => {
    const { db } = fakeD1();
    await db.batch([
      db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES ('coverage', '{\"patches\":[\"16.21\"],\"games\":[],\"timeline\":[],\"players\":[]}', 1700000000000)"),
      db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES ('bans', '{\"patches\":[],\"champions\":[]}', 0)"),
    ]);
    const app = createApp(new MemoryStore(), { statsDb: db });
    const stamped = (await (await app.request("/v1/meta/coverage")).json()) as Record<string, unknown>;
    expect(stamped.updatedAt).toBe(1700000000000);
    expect(stamped.patches).toEqual(["16.21"]);
    const bare = (await (await app.request("/v1/bans")).json()) as Record<string, unknown>;
    expect(bare).not.toHaveProperty("updatedAt");
  });
});
