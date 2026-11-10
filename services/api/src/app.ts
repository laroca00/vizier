import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { BRACKETS, DEFAULT_BRACKET, REGION_BRACKETS, isRegion, parseBracket, type Bracket, type Region } from "@vizier/shared/brackets";
import { HTTPException } from "hono/http-exception";
import type { Catalog } from "./archetypes.ts";
import { POSITIONS, type Build } from "./builds.ts";
import { AUGMENT_QUEUES, docKey, readDoc } from "./statDocs.ts";
import type { Coverage } from "./coverage.ts";
import { STORED_QUEUES } from "./crawler.ts";
import { proBuilds, proMeta, proPatches, proTeams } from "./pros.ts";
import { PLATFORMS, type Platform, type RiotClient } from "./riot/client.ts";
import { parseAsks, scout } from "./scout.ts";
import type { Store } from "./store.ts";

const MINUTE = 60_000;
// Tauri serves the app from these origins on Windows; 1420 is the dev server.
const ORIGINS = ["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost", "http://localhost:1420"];

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

export type AppOptions = {
  /** Holds stat_docs, which services/crawler fills; without it the stats routes answer 503. */
  statsDb?: D1Database;
  /** Arena and ARAM Mayhem augment stats; the owner switches them off with the AUGMENTS variable. */
  augments?: boolean;
  /** Arena item stats; the owner switches them off with ARENA_ITEMS=off. */
  arenaItems?: boolean;
  /** Looks players up for the loading screen scouting; without a Riot key the route answers 503. */
  riot?: RiotClient;
  /** Data Dragon items, to name pro builds' styles; without it they have none. */
  catalog?: () => Promise<Catalog>;
};

/**
 * The rank bracket asked for. Missing means Emerald+, unknown is a 400. Only
 * ranked solo is split by rank; other queues answer with their one set of docs.
 */
function rankOf(c: Context, queue = 420): Bracket {
  const rank = parseBracket(c.req.query("rank"));
  if (!rank) badRequest("Unsupported rank");
  return queue === 420 ? rank : DEFAULT_BRACKET;
}

/** `?region=`: missing means all three pooled, unknown is a 400. */
function regionOf(c: Context): Region | null {
  const region = c.req.query("region");
  if (region === undefined) return null;
  if (!isRegion(region)) badRequest("Unsupported region");
  return region;
}

/** The doc with the bracket it belongs to, so the app can show which one it got. */
const withRank = <T extends object>(doc: T, rank: Bracket) => ({ ...doc, rank });

/** Ranked solo unless `?queue=` names another stored queue. */
function queueOf(value: string | undefined): number {
  if (value === undefined) return 420;
  const queue = Number(value);
  if (!STORED_QUEUES.has(queue)) badRequest("Unsupported queue");
  return queue;
}

/**
 * Every route but /v1/scout reads what services/crawler published to D1, so
 * the Worker makes no Riot calls for them and needs no Riot key.
 */
export function createApp(store: Store, { statsDb, catalog, riot, augments = false, arenaItems = true }: AppOptions = {}) {
  // Concurrent misses for the same key share one load.
  const pending = new Map<string, Promise<unknown>>();

  async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = await store.getCached<T>(key);
    if (hit !== undefined) return hit;
    let promise = pending.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = load()
        .then(async (value) => {
          await store.putCached(key, value, ttlMs);
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, promise);
    }
    return promise;
  }

  const app = new Hono();
  app.use("/v1/*", cors({ origin: ORIGINS, allowMethods: ["GET"] }));

  app.get("/health", (c) => c.json({ ok: true }));

  // Registered before the champion route so "index" isn't read as an id.
  app.get("/v1/builds/index", async (c) => {
    if (!statsDb) return c.json({ error: "Build stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.buildIndex())) ?? { patches: [], builds: [] });
  });

  // Two path segments, so it never collides with the champion route below.
  app.get("/v1/builds/history/:championId", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    if (!statsDb) return c.json({ error: "Build stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.buildHistory(championId, position))) ?? { snapshots: [] });
  });

  app.get("/v1/builds/:championId", async (c) => {
    const championId = Number(c.req.param("championId"));
    if (!Number.isInteger(championId) || championId <= 0) badRequest("Invalid champion id");
    const position = c.req.query("position")?.toUpperCase() ?? null;
    if (position !== null && !POSITIONS.has(position)) badRequest("Unsupported position");
    const vsParam = c.req.query("vs");
    const vs = vsParam === undefined ? null : Number(vsParam);
    if (vs !== null && (!Number.isInteger(vs) || vs <= 0)) badRequest("Invalid opponent champion id");
    const queue = queueOf(c.req.query("queue"));
    const rank = rankOf(c, queue);
    if (!statsDb) return c.json({ error: "Build stats are not available" }, 503);

    const role = queue === 420 ? position : null;
    // A matchup without enough games gets the champion's overall build, as aggregateBuild does.
    const matchups = vs && role && queue === 420 ? await readDoc<Record<number, Build>>(statsDb, docKey.matchupBuilds(championId, role, rank)) : null;
    const overall = await readDoc<Build>(statsDb, docKey.build(queue, championId, role, rank));
    const matchup = matchups?.[vs!];
    if (!overall && !matchup) return c.json({ error: "No games for this champion yet", rank }, 404);
    // Matchups are too thin to split by build style, so they borrow the champion's.
    if (!matchup) return c.json(withRank(overall!, rank));
    return c.json(withRank({ ...matchup, variants: overall?.variants ?? [], situational: overall?.situational ?? [] }, rank));
  });

  // Queues without roles (ARAM, Arena, URF) use ALL.
  app.get("/v1/tierlist/:position", async (c) => {
    const queue = queueOf(c.req.query("queue"));
    const position = c.req.param("position").toUpperCase();
    if (queue === 420 ? !POSITIONS.has(position) : position !== "ALL") badRequest("Unsupported position");
    const rank = rankOf(c, queue);
    const region = queue === 420 ? regionOf(c) : null;
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    if (region) {
      const list = REGION_BRACKETS.includes(rank) ? await readDoc<object>(statsDb, docKey.tierRegion(position, region, rank)) : null;
      return c.json({ ...withRank(list ?? { patches: [], games: 0, champions: [] }, rank), region });
    }
    const list = await readDoc<object>(statsDb, docKey.tierList(queue, position, rank));
    return c.json(withRank(list ?? { patches: [], games: 0, champions: [] }, rank));
  });

  const championRequest = (c: Context) => {
    const championId = Number(c.req.param("championId"));
    if (!Number.isInteger(championId) || championId <= 0) badRequest("Invalid champion id");
    const position = c.req.query("position")?.toUpperCase() ?? null;
    if (position !== null && !POSITIONS.has(position)) badRequest("Unsupported position");
    return { championId, position };
  };

  app.get("/v1/champions/:championId", async (c) => {
    const { championId, position } = championRequest(c);
    const queue = queueOf(c.req.query("queue"));
    const rank = rankOf(c, queue);
    const region = queue === 420 ? regionOf(c) : null;
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    if (region) {
      const roles = REGION_BRACKETS.includes(rank)
        ? await readDoc<Record<string, Partial<Record<Region, object>>>>(statsDb, docKey.championRegions(championId, rank))
        : null;
      // Same fallback as below: a role without games in this region gets the champion's most played.
      const found = (position && roles?.[position]?.[region]) || roles?.ANY?.[region];
      if (!found) return c.json({ error: "No games for this champion yet", rank, region }, 404);
      return c.json({ ...withRank(found, rank), region });
    }
    // A role the champion has no games in gets its most played role, as championOverview does.
    const overview =
      (await readDoc<object>(statsDb, docKey.champion(queue, championId, queue === 420 ? position : null, rank))) ??
      (position ? await readDoc<object>(statsDb, docKey.champion(queue, championId, null, rank)) : null);
    if (!overview) return c.json({ error: "No games for this champion yet", rank }, 404);
    return c.json(withRank(overview, rank));
  });

  app.get("/v1/champions/:championId/counters", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    const rank = rankOf(c);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json(withRank((await readDoc<object>(statsDb, docKey.counters(championId, position, rank))) ?? { patches: [], games: 0, matchups: [] }, rank));
  });

  app.get("/v1/champions/:championId/lane", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    const vs = Number(c.req.query("vs"));
    if (!Number.isInteger(vs) || vs <= 0) badRequest("Invalid opponent champion id");
    const rank = rankOf(c);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const lanes = await readDoc<Record<number, object>>(statsDb, docKey.lane(championId, position, rank));
    return c.json(withRank(lanes?.[vs] ?? { games: 0 }, rank));
  });

  app.get("/v1/champions/:championId/item-times", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.itemTimes(championId, position))) ?? {});
  });

  app.get("/v1/champions/:championId/bench", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    const rank = rankOf(c);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json(withRank((await readDoc<object>(statsDb, docKey.bench(420, championId, position, rank))) ?? { minutes: [] }, rank));
  });

  app.get("/v1/champions/:championId/synergies", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    const rank = rankOf(c);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json(withRank((await readDoc<object>(statsDb, docKey.synergies(championId, position, rank))) ?? { patches: [], games: 0, allies: [] }, rank));
  });

  app.get("/v1/arena/duos/:championId", async (c) => {
    const { championId } = championRequest(c);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.duos(championId))) ?? { patches: [], games: 0, partners: [] });
  });

  app.get("/v1/arena/items/:championId", async (c) => {
    if (!arenaItems) return c.json({ error: "Arena item stats are switched off" }, 403);
    const { championId } = championRequest(c);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.arenaItems(championId))) ?? { patches: [], games: 0, items: [] });
  });

  app.get("/v1/pros/builds", async (c) => {
    const championParam = c.req.query("champion");
    const championId = championParam === undefined ? undefined : Number(championParam);
    if (championId !== undefined && (!Number.isInteger(championId) || championId <= 0)) badRequest("Invalid champion id");
    const position = c.req.query("position")?.toUpperCase();
    if (position !== undefined && !POSITIONS.has(position)) badRequest("Unsupported position");
    const team = c.req.query("team");
    if (team !== undefined && !/^[\w .-]{1,40}$/.test(team)) badRequest("Invalid team");
    const group = c.req.query("group");
    if (group !== undefined && group !== "worlds" && group !== "turkey" && group !== "challenger") badRequest("Unsupported group");
    const player = c.req.query("player");
    if (player !== undefined && !/^[\p{L}\p{N} ._#-]{1,40}$/u.test(player)) badRequest("Invalid player");
    const platform = c.req.query("platform");
    if (platform !== undefined && !/^[a-z]{2,4}\d?$/.test(platform)) badRequest("Invalid platform");
    const patch = c.req.query("patch");
    if (patch !== undefined && !/^\d{1,2}\.\d{1,2}$/.test(patch)) badRequest("Invalid patch");
    const limit = Number(c.req.query("limit") ?? 30);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) badRequest("limit must be 1-100");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const key = ["pro-builds", championId, position, team, group, player, platform, patch, limit].map((v) => v ?? "ANY").join(":");
    // Pro games arrive every few minutes; a short cache keeps the list fresh.
    const load = async () => {
      // A Data Dragon outage costs the style labels, not the list.
      const items = catalog ? await catalog().catch(() => null) : null;
      return proBuilds(statsDb, { championId, position, team, group, player, platform, patch, limit }, items);
    };
    return c.json({ builds: await cached(key, 5 * MINUTE, load) });
  });

  app.get("/v1/augments/champions", async (c) => {
    if (!augments) return c.json({ error: "Augment stats are switched off" }, 403);
    const queue = Number(c.req.query("queue"));
    if (!AUGMENT_QUEUES.includes(queue)) badRequest("Unsupported queue");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.augmentChampions(queue))) ?? { patches: [], augments: [] });
  });

  app.get("/v1/augments", async (c) => {
    if (!augments) return c.json({ error: "Augment stats are switched off" }, 403);
    const queue = Number(c.req.query("queue"));
    if (!AUGMENT_QUEUES.includes(queue)) badRequest("Unsupported queue");
    const championParam = c.req.query("champion");
    const championId = championParam === undefined ? null : Number(championParam);
    if (championId !== null && (!Number.isInteger(championId) || championId <= 0)) badRequest("Invalid champion id");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.augments(queue, championId))) ?? { patches: [], games: 0, augments: [] });
  });

  app.get("/v1/pros/meta", async (c) => {
    const group = c.req.query("group");
    if (group !== undefined && group !== "worlds" && group !== "turkey" && group !== "challenger") badRequest("Unsupported group");
    const patch = c.req.query("patch");
    if (patch !== undefined && !/^\d{1,2}\.\d{1,2}$/.test(patch)) badRequest("Invalid patch");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const key = `pro-meta:${group ?? "ANY"}:${patch ?? "ANY"}`;
    return c.json({ champions: await cached(key, 30 * MINUTE, () => proMeta(statsDb, { group, patch })) });
  });

  app.get("/v1/pros/patches", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json({ patches: await cached("pro-patches", 60 * MINUTE, () => proPatches(statsDb)) });
  });

  app.get("/v1/pros/teams", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json({ teams: await cached("pro-teams", 60 * MINUTE, () => proTeams(statsDb)) });
  });

  app.get("/v1/meta/rank-curve", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.rankCurve(420))) ?? { patches: [], brackets: BRACKETS, entries: [] });
  });

  app.get("/v1/history/:championId", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const id = Number(c.req.param("championId"));
    if (!Number.isInteger(id) || id <= 0) badRequest("Invalid champion id");
    return c.json((await readDoc(statsDb, docKey.history(id))) ?? { fields: [], roles: {} });
  });

  app.get("/v1/history/tier/:position", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const position = c.req.param("position").toUpperCase();
    if (!POSITIONS.has(position)) badRequest("Invalid position");
    return c.json((await readDoc(statsDb, docKey.historyTier(position))) ?? { patch: null, days: [], champions: {} });
  });

  app.get("/v1/meta/coverage", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc<Coverage>(statsDb, docKey.coverage())) ?? { patches: [], games: [], timeline: [], players: [] });
  });

  app.get("/v1/bans", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.bans())) ?? { patches: [], champions: [] });
  });

  // The one route that calls Riot. Rank and mastery per player, cached for 15 minutes.
  app.get("/v1/scout", async (c) => {
    if (!riot) return c.json({ error: "Scouting is not set up" }, 503);
    const platform = c.req.query("platform") as Platform;
    if (!PLATFORMS.includes(platform)) badRequest("Unknown platform");
    const asks = parseAsks(c.req.query("players"));
    if (!asks) badRequest("Expected up to 10 puuid:championId pairs");
    return c.json({ players: await scout(riot, store, platform, asks) });
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
