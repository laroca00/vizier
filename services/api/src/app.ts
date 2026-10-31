import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Cache } from "./cache.ts";
import { RiotError, type RiotClient } from "./riot/client.ts";
import type { Account, LeagueEntry, Match, Summoner } from "./riot/types.ts";

const MINUTE = 60_000;
const QUEUES = new Set([400, 420, 440, 450, 490, 1700]);

// Riot IDs: 3-16 character names, 3-5 character tags.
const GAME_NAME = /^.{3,16}$/u;
const TAG_LINE = /^[\p{L}\p{N}]{3,5}$/u;
const PUUID = /^[\w-]{78}$/;
const MATCH_ID = /^TR1_\d+$/;

// Tauri serves the app from these origins on Windows; 1420 is the dev server.
const ORIGINS = ["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost", "http://localhost:1420"];

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

export function createApp(riot: RiotClient) {
  const accounts = new Cache<Account | null>(10_000);
  const profiles = new Cache<unknown>(10_000);
  const matchIds = new Cache<string[] | null>(10_000);
  // Match documents never change once a game is over.
  const matches = new Cache<Match | null>(5_000);

  const app = new Hono();
  app.use("/v1/*", cors({ origin: ORIGINS, allowMethods: ["GET"] }));

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/v1/profiles/:gameName/:tagLine", async (c) => {
    const { gameName, tagLine } = c.req.param();
    if (!GAME_NAME.test(gameName) || !TAG_LINE.test(tagLine)) badRequest("Invalid Riot ID");

    const key = `${gameName}#${tagLine}`.toLowerCase();
    const account = await accounts.getOrLoad(key, 60 * MINUTE, () =>
      riot.get<Account>(
        "europe",
        "/riot/account/v1/accounts/by-riot-id",
        `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      ),
    );
    if (!account) return c.json({ error: "Riot ID not found" }, 404);

    const profile = await profiles.getOrLoad(account.puuid, 5 * MINUTE, async () => {
      const [summoner, ranks] = await Promise.all([
        riot.get<Summoner>("tr1", "/lol/summoner/v4/summoners/by-puuid", `/lol/summoner/v4/summoners/by-puuid/${account.puuid}`),
        riot.get<LeagueEntry[]>("tr1", "/lol/league/v4/entries/by-puuid", `/lol/league/v4/entries/by-puuid/${account.puuid}`),
      ]);
      return {
        account,
        summoner: summoner && { profileIconId: summoner.profileIconId, summonerLevel: summoner.summonerLevel },
        ranks: (ranks ?? []).map(({ queueType, tier, rank, leaguePoints, wins, losses }) => ({
          queueType,
          tier,
          rank,
          leaguePoints,
          wins,
          losses,
        })),
      };
    });
    return c.json(profile);
  });

  app.get("/v1/players/:puuid/matches", async (c) => {
    const { puuid } = c.req.param();
    if (!PUUID.test(puuid)) badRequest("Invalid PUUID");
    const count = Number(c.req.query("count") ?? 20);
    if (!Number.isInteger(count) || count < 1 || count > 100) badRequest("count must be 1-100");
    const queueParam = c.req.query("queue");
    const queue = queueParam === undefined ? undefined : Number(queueParam);
    if (queue !== undefined && !QUEUES.has(queue)) badRequest("Unsupported queue");

    const search = new URLSearchParams({ start: "0", count: String(count) });
    if (queue !== undefined) search.set("queue", String(queue));
    const ids = await matchIds.getOrLoad(`${puuid}?${search}`, 2 * MINUTE, () =>
      riot.get<string[]>(
        "europe",
        "/lol/match/v5/matches/by-puuid/ids",
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?${search}`,
      ),
    );
    return c.json({ matchIds: ids ?? [] });
  });

  app.get("/v1/matches/:matchId", async (c) => {
    const { matchId } = c.req.param();
    if (!MATCH_ID.test(matchId)) badRequest("Invalid match ID");
    const match = await matches.getOrLoad(matchId, Infinity, () =>
      riot.get<Match>("europe", "/lol/match/v5/matches", `/lol/match/v5/matches/${matchId}`),
    );
    if (!match) return c.json({ error: "Match not found" }, 404);
    return c.json(match);
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    if (error instanceof RiotError) {
      console.error(error.message);
      return c.json({ error: "Riot API unavailable" }, error.status === 429 ? 503 : 502);
    }
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
