import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { RiotError, type RiotClient } from "./riot/client.ts";
import { MemoryStore } from "./store.ts";

const PUUID = "x".repeat(78);

function fakeRiot(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const riot = {
    get: async (_routing: string, _method: string, path: string) => {
      calls.push(path);
      const value = routes[path];
      if (value instanceof Error) throw value;
      return value ?? null;
    },
  } as unknown as RiotClient;
  return { app: createApp(riot, new MemoryStore()), calls };
}

describe("api", () => {
  it("builds a profile from account, summoner and league entries", async () => {
    const { app, calls } = fakeRiot({
      "/riot/account/v1/accounts/by-riot-id/%C3%87a%C4%9Fr%C4%B1/TR1": { puuid: PUUID, gameName: "Çağrı", tagLine: "TR1" },
      [`/lol/summoner/v4/summoners/by-puuid/${PUUID}`]: { puuid: PUUID, profileIconId: 7, summonerLevel: 300, id: "hidden" },
      [`/lol/league/v4/entries/by-puuid/${PUUID}`]: [
        { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 40, wins: 10, losses: 8, puuid: PUUID },
      ],
    });
    const response = await app.request("/v1/profiles/%C3%87a%C4%9Fr%C4%B1/TR1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      account: { puuid: PUUID, gameName: "Çağrı", tagLine: "TR1" },
      summoner: { profileIconId: 7, summonerLevel: 300 },
      ranks: [{ queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 40, wins: 10, losses: 8 }],
    });

    // Riot IDs are case-insensitive. "I" is left out because JavaScript lowers
    // it to "i", not the Turkish "ı".
    await app.request("/v1/profiles/%C3%87A%C4%9Er%C4%B1/tr1");
    expect(calls).toHaveLength(3);
  });

  it("returns 404 for an unknown Riot ID", async () => {
    const { app } = fakeRiot({});
    expect((await app.request("/v1/profiles/Nobody/TR1")).status).toBe(404);
  });

  it("validates input before calling Riot", async () => {
    const { app, calls } = fakeRiot({});
    expect((await app.request("/v1/profiles/ab/TR1")).status).toBe(400);
    expect((await app.request(`/v1/players/${PUUID}/matches?count=500`)).status).toBe(400);
    expect((await app.request(`/v1/players/${PUUID}/matches?queue=999`)).status).toBe(400);
    expect((await app.request("/v1/matches/EUW1_123")).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("lists match ids with queue and count", async () => {
    const { app, calls } = fakeRiot({
      [`/lol/match/v5/matches/by-puuid/${PUUID}/ids?start=0&count=5&queue=420`]: ["TR1_1", "TR1_2"],
    });
    const response = await app.request(`/v1/players/${PUUID}/matches?count=5&queue=420`);
    expect(await response.json()).toEqual({ matchIds: ["TR1_1", "TR1_2"] });
    expect(calls).toHaveLength(1);
  });

  it("caches match documents", async () => {
    const match = { metadata: { matchId: "TR1_9", participants: [] }, info: { participants: [] } };
    const { app, calls } = fakeRiot({ "/lol/match/v5/matches/TR1_9": match });
    await app.request("/v1/matches/TR1_9");
    const response = await app.request("/v1/matches/TR1_9");
    expect(await response.json()).toEqual(match);
    expect(calls).toHaveLength(1);
  });

  it("hides Riot errors behind a gateway status", async () => {
    const { app } = fakeRiot({ "/lol/match/v5/matches/TR1_1": new RiotError(500, "m") });
    const response = await app.request("/v1/matches/TR1_1");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Riot API unavailable" });
  });

  it("allows the desktop app origin", async () => {
    const { app } = fakeRiot({});
    const response = await app.request("/v1/matches/TR1_1", { headers: { Origin: "http://tauri.localhost" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://tauri.localhost");
  });
});

describe("live game", () => {
  it("adds ranks and champion mastery to everyone in the game", async () => {
    const other = "y".repeat(78);
    const { app, calls } = fakeRiot({
      [`/lol/spectator/v5/active-games/by-summoner/${PUUID}`]: {
        gameId: 77,
        gameQueueConfigId: 420,
        participants: [
          { puuid: PUUID, riotId: "Ben#TR1", championId: 103, teamId: 100, spell1Id: 4, spell2Id: 14 },
          { puuid: other, riotId: "Rakip#TR1", championId: 238, teamId: 200, spell1Id: 4, spell2Id: 12 },
        ],
      },
      [`/lol/league/v4/entries/by-puuid/${PUUID}`]: [
        { queueType: "RANKED_FLEX_SR", tier: "GOLD", rank: "I", leaguePoints: 3, wins: 1, losses: 1 },
        { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 45, wins: 60, losses: 50 },
      ],
      [`/lol/champion-mastery/v4/champion-masteries/by-puuid/${other}/by-champion/238`]: { championId: 238, championLevel: 12, championPoints: 140000, lastPlayTime: 5 },
    });
    const response = await app.request(`/v1/live/${PUUID}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { players: unknown[] };
    expect(body.players).toEqual([
      { riotId: "Ben#TR1", championId: 103, teamId: 100, you: true, solo: { tier: "EMERALD", rank: "II", leaguePoints: 45, wins: 60, losses: 50 }, mastery: null },
      { riotId: "Rakip#TR1", championId: 238, teamId: 200, you: false, solo: null, mastery: { level: 12, points: 140000, lastPlayTime: 5 } },
    ]);
    // A second look during the same loading screen costs nothing.
    const before = calls.length;
    await app.request(`/v1/live/${PUUID}`);
    expect(calls.length).toBe(before);
  });

  it("answers 404 outside a game", async () => {
    const { app } = fakeRiot({});
    expect((await app.request(`/v1/live/${PUUID}`)).status).toBe(404);
  });
});
