import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { MemoryStore } from "./store.ts";

const app = () => createApp(new MemoryStore());

describe("api", () => {
  it("allows the desktop app origin", async () => {
    const response = await app().request("/v1/bans", { headers: { Origin: "http://tauri.localhost" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://tauri.localhost");
  });

  it("checks the queue and the role it allows", async () => {
    expect((await app().request("/v1/tierlist/MIDDLE?queue=999")).status).toBe(400);
    expect((await app().request("/v1/tierlist/MIDDLE?queue=450")).status).toBe(400);
    expect((await app().request("/v1/tierlist/ALL")).status).toBe(400);
  });

  it("no longer serves player, match, coach or augment routes", async () => {
    for (const path of ["/v1/profiles/a/b", "/v1/matches/TR1_1", "/v1/players/x/lp", "/v1/champions/103/arena-augments"]) {
      expect((await app().request(path)).status).toBe(404);
    }
    expect((await app().request("/v1/coach/TR1_1", { method: "POST" })).status).toBe(404);
  });

  it("serves augments only while the switch is on", async () => {
    expect((await app().request("/v1/augments?queue=1700")).status).toBe(403);
    expect((await app().request("/v1/augments/champions?queue=1700")).status).toBe(403);
    const on = createApp(new MemoryStore(), { augments: true });
    expect((await on.request("/v1/augments?queue=420")).status).toBe(400);
    expect((await on.request("/v1/augments?queue=1700&champion=x")).status).toBe(400);
  });

  it("serves Arena items unless they are switched off", async () => {
    expect((await app().request("/v1/arena/items/103")).status).toBe(503);
    const off = createApp(new MemoryStore(), { arenaItems: false });
    expect((await off.request("/v1/arena/items/103")).status).toBe(403);
    expect((await app().request("/v1/arena/items/x")).status).toBe(400);
    expect((await app().request("/v1/arena/duos/x")).status).toBe(400);
  });
});
