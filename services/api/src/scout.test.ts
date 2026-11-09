import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { RiotClient } from "./riot/client.ts";
import { parseAsks, scout, soloEntry } from "./scout.ts";
import { MemoryStore } from "./store.ts";

const PUUID = "p".repeat(78);

function fakeRiot(calls: string[]) {
  const fetcher = (async (url: string) => {
    calls.push(String(url));
    const body = String(url).includes("league/v4")
      ? [{ queueType: "RANKED_FLEX_SR", tier: "GOLD", rank: "I", leaguePoints: 1, wins: 1, losses: 1 }, { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 40, wins: 60, losses: 50, hotStreak: true }]
      : { championLevel: 7, championPoints: 150000 };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return new RiotClient({ apiKey: "k", fetch: fetcher });
}

describe("scout", () => {
  it("reads the solo entry and the mastery", async () => {
    const [player] = await scout(fakeRiot([]), new MemoryStore(), "tr1", [{ puuid: PUUID, championId: 103 }]);
    expect(player.rank).toEqual({ tier: "EMERALD", division: "II", lp: 40, wins: 60, losses: 50, winStreak: true });
    expect(player.mastery).toEqual({ level: 7, points: 150000 });
  });

  it("asks Riot once per player per cache window", async () => {
    const calls: string[] = [];
    const store = new MemoryStore();
    const riot = fakeRiot(calls);
    await scout(riot, store, "tr1", [{ puuid: PUUID, championId: 103 }]);
    await scout(riot, store, "tr1", [{ puuid: PUUID, championId: 103 }]);
    expect(calls).toHaveLength(2);
  });

  it("leaves out a player Riot fails on", async () => {
    const riot = new RiotClient({ apiKey: "k", fetch: (async () => new Response("no", { status: 403 })) as unknown as typeof fetch });
    expect(await scout(riot, new MemoryStore(), "tr1", [{ puuid: PUUID, championId: 1 }])).toEqual([]);
  });

  it("has no ranked entry for unranked players", () => {
    expect(soloEntry(null)).toBeNull();
    expect(soloEntry([])).toBeNull();
  });

  it("checks the ask", () => {
    expect(parseAsks(`${PUUID}:103,${PUUID}:64`)).toHaveLength(2);
    expect(parseAsks("short:103")).toBeNull();
    expect(parseAsks(`${PUUID}:x`)).toBeNull();
    expect(parseAsks(Array.from({ length: 11 }, () => `${PUUID}:1`).join(","))).toBeNull();
    expect(parseAsks(undefined)).toBeNull();
  });
});

describe("/v1/scout", () => {
  it("answers 503 while no Riot key is set", async () => {
    const app = createApp(new MemoryStore());
    expect((await app.request(`/v1/scout?platform=tr1&players=${PUUID}:103`)).status).toBe(503);
  });

  it("validates platform and players, then returns the players", async () => {
    const app = createApp(new MemoryStore(), { riot: fakeRiot([]) });
    expect((await app.request(`/v1/scout?platform=xx&players=${PUUID}:103`)).status).toBe(400);
    expect((await app.request("/v1/scout?platform=tr1&players=bad")).status).toBe(400);
    const ok = await app.request(`/v1/scout?platform=tr1&players=${PUUID}:103`);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { players: unknown[] }).players).toHaveLength(1);
  });
});
