import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type Anthropic from "@anthropic-ai/sdk";
import type { Catalog } from "./archetypes.ts";
import { POSITIONS, type Build } from "./builds.ts";
import { coach, summarize, type Coaching, type CoachMatch, type Timeline } from "./coach.ts";
import { rewriteWithWorkersAi } from "./coachRewrite.ts";
import { coachByRules } from "./coachRules.ts";
import type { Benchmarks, Pace } from "./stats.ts";
import { docKey, readDoc } from "./statDocs.ts";
import { STORED_QUEUES } from "./crawler.ts";
import { proBuilds, proTeams } from "./pros.ts";
import { csByMinute, goldGraph, type Timeline as FullTimeline } from "./timeline.ts";
import { scoreGame, weakestMinutes } from "./report.ts";
import { championPool, lpHistory, recordLp } from "./profileStats.ts";
import { findHabits, gameNumbers } from "./trends.ts";
import { MATCH_ID, RiotError, regionOfMatch, type Platform, type RiotClient } from "./riot/client.ts";
import type { Account, ActiveGame, ChampionMastery, LeagueEntry, Match, Summoner } from "./riot/types.ts";
import type { Store } from "./store.ts";

const MINUTE = 60_000;
const QUEUES = new Set([400, 420, 440, 450, 490, 1700]);

// Riot IDs: 3-16 character names, 3-5 character tags.
const GAME_NAME = /^.{3,16}$/u;
const TAG_LINE = /^[\p{L}\p{N}]{3,5}$/u;
const PUUID = /^[\w-]{78}$/;

// Tauri serves the app from these origins on Windows; 1420 is the dev server.
const ORIGINS = ["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost", "http://localhost:1420"];

function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

export type CoachConfig = {
  client: Anthropic;
  /** Coaching costs money per call, so only these accounts can request it. */
  allowedPuuids: Set<string>;
  dailyLimit: number;
};

// A rewrite costs ~100 of the 10,000 free daily Workers AI neurons; past this
// the rule wording is served as is.
const FREE_REWRITES_PER_DAY = 80;

export type AppOptions = {
  /** Holds stat_docs, which services/crawler fills; without it the stats routes answer 503. */
  statsDb?: D1Database;
  /** Claude coaching for allowed accounts; everyone else gets the free coach. */
  claude?: CoachConfig;
  /** Workers AI binding that rewords the free coach's findings. */
  ai?: { run(model: string, input: unknown): Promise<unknown> };
  /** Arena augment stats; off until Riot approves showing them. */
  arenaAugments?: boolean;
  /** ARAM Mayhem augment tiers; off until Riot confirms they may be shown. */
  mayhemAugments?: boolean;
  /** Data Dragon items, to name pro builds' styles; without it they have none. */
  catalog?: () => Promise<Catalog>;
};

export type CoachResult = Coaching & { source: "claude" | "workers-ai" | "rules" };

// Players Vizier serves: TR and EUW. KR and NA are read only for pros.
const PLAYER_PLATFORMS = new Set<Platform>(["tr1", "euw1"]);

/** TR unless `?platform=` names EUW. */
function platformOf(value: string | undefined): Platform {
  if (value === undefined) return "tr1";
  if (!PLAYER_PLATFORMS.has(value as Platform)) badRequest("Unsupported platform");
  return value as Platform;
}

/** Ranked solo unless `?queue=` names another stored queue. */
function queueOf(value: string | undefined): number {
  if (value === undefined) return 420;
  const queue = Number(value);
  if (!STORED_QUEUES.has(queue)) badRequest("Unsupported queue");
  return queue;
}

export function createApp(riot: RiotClient, store: Store, { statsDb, claude, ai, arenaAugments = false, mayhemAugments = false, catalog }: AppOptions = {}) {
  // Concurrent misses for the same key share one Riot call.
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
  app.use("/v1/*", cors({ origin: ORIGINS, allowMethods: ["GET", "POST"] }));

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/v1/profiles/:gameName/:tagLine", async (c) => {
    const { gameName, tagLine } = c.req.param();
    if (!GAME_NAME.test(gameName) || !TAG_LINE.test(tagLine)) badRequest("Invalid Riot ID");
    const platform = platformOf(c.req.query("platform"));

    const key = `${gameName}#${tagLine}`.toLowerCase();
    const account = await cached(`account:${key}`, 60 * MINUTE, () =>
      riot.get<Account>(
        "europe",
        "/riot/account/v1/accounts/by-riot-id",
        `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      ),
    );
    if (!account) return c.json({ error: "Riot ID not found" }, 404);

    const profile = await cached(`profile:${platform}:${account.puuid}`, 5 * MINUTE, async () => {
      const [summoner, ranks] = await Promise.all([
        riot.get<Summoner>(platform, "/lol/summoner/v4/summoners/by-puuid", `/lol/summoner/v4/summoners/by-puuid/${account.puuid}`),
        riot.get<LeagueEntry[]>(platform, "/lol/league/v4/entries/by-puuid", `/lol/league/v4/entries/by-puuid/${account.puuid}`),
      ]);
      // A fresh rank read is when LP history gets its next point.
      if (statsDb && ranks?.length) await recordLp(statsDb, account.puuid, ranks).catch((error) => console.error(error));
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

  // The loading screen: who is in the player's game, once the game has revealed them.
  app.get("/v1/live/:puuid", async (c) => {
    const { puuid } = c.req.param();
    if (!PUUID.test(puuid)) badRequest("Invalid PUUID");
    const platform = platformOf(c.req.query("platform"));
    const game = await cached(`active-game:${platform}:${puuid}`, MINUTE, () =>
      riot.get<ActiveGame>(
        platform,
        "/lol/spectator/v5/active-games/by-summoner",
        `/lol/spectator/v5/active-games/by-summoner/${puuid}`,
      ),
    );
    if (!game) return c.json({ error: "Not in a game" }, 404);

    const players = await Promise.all(
      game.participants.map(async (p) => {
        // Bots and some special modes have no PUUID.
        if (!p.puuid) return { riotId: p.riotId ?? null, championId: p.championId, teamId: p.teamId, you: false, solo: null, mastery: null };
        const [ranks, mastery] = await Promise.all([
          cached(`ranks:${p.puuid}`, 30 * MINUTE, () =>
            riot.get<LeagueEntry[]>(platform, "/lol/league/v4/entries/by-puuid", `/lol/league/v4/entries/by-puuid/${p.puuid}`),
          ),
          cached(`mastery:${p.puuid}:${p.championId}`, 30 * MINUTE, () =>
            riot.get<ChampionMastery>(
              platform,
              "/lol/champion-mastery/v4/champion-masteries/by-puuid/by-champion",
              `/lol/champion-mastery/v4/champion-masteries/by-puuid/${p.puuid}/by-champion/${p.championId}`,
            ),
          ),
        ]);
        const solo = ranks?.find((r) => r.queueType === "RANKED_SOLO_5x5");
        return {
          riotId: p.riotId ?? null,
          championId: p.championId,
          teamId: p.teamId,
          you: p.puuid === puuid,
          solo: solo ? { tier: solo.tier, rank: solo.rank, leaguePoints: solo.leaguePoints, wins: solo.wins, losses: solo.losses } : null,
          mastery: mastery ? { level: mastery.championLevel, points: mastery.championPoints, lastPlayTime: mastery.lastPlayTime } : null,
        };
      }),
    );
    return c.json({ gameId: game.gameId, queueId: game.gameQueueConfigId ?? null, players });
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
    const ids = await cached(`match-ids:${puuid}?${search}`, 2 * MINUTE, () =>
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
    // Match documents never change once a game is over.
    const stored = await store.getMatch(matchId);
    if (stored) return c.json(stored);
    const match = await riot.get<Match>(regionOfMatch(matchId), "/lol/match/v5/matches", `/lol/match/v5/matches/${matchId}`);
    if (!match) return c.json({ error: "Match not found" }, 404);
    await store.putMatch(match);
    return c.json(match);
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
    if (!statsDb) return c.json({ error: "Build stats are not available" }, 503);

    const role = queue === 420 ? position : null;
    // A matchup without enough games gets the champion's overall build, as aggregateBuild does.
    const matchups = vs && role && queue === 420 ? await readDoc<Record<number, Build>>(statsDb, docKey.matchupBuilds(championId, role)) : null;
    const overall = await readDoc<Build>(statsDb, docKey.build(queue, championId, role));
    const matchup = matchups?.[vs!];
    if (!overall && !matchup) return c.json({ error: "No games for this champion yet" }, 404);
    // Matchups are too thin to split by build style, so they borrow the champion's.
    if (!matchup) return c.json(overall);
    return c.json({ ...matchup, variants: overall?.variants ?? [], situational: overall?.situational ?? [] });
  });

  /** The champion's doc when it has enough games, else the role's, else an empty answer. */
  async function perChampion<T>(key: (championId: number | null) => string, championId: number | null, empty: T): Promise<T> {
    if (!statsDb) return empty;
    const own = championId ? await readDoc<T>(statsDb, key(championId)) : null;
    return own ?? (await readDoc<T>(statsDb, key(null))) ?? empty;
  }

  const benchmarksFor = (position: string, championId: number | null = null) =>
    statsDb
      ? perChampion<Benchmarks>((id) => docKey.benchmarks(position, id), championId, { position, championId: null, patches: [], metrics: {} })
      : Promise.resolve(undefined);

  const paceFor = (position: string, championId: number | null) =>
    perChampion<Pace>((id) => docKey.pace(position, id), championId, { position, championId: null, patches: [], games: 0, median: [] });

  app.get("/v1/benchmarks/:position", async (c) => {
    const position = c.req.param("position").toUpperCase();
    if (!POSITIONS.has(position)) badRequest("Unsupported position");
    const championParam = c.req.query("champion");
    const championId = championParam === undefined ? null : Number(championParam);
    if (championId !== null && (!Number.isInteger(championId) || championId <= 0)) badRequest("Invalid champion id");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json(await benchmarksFor(position, championId));
  });

  app.get("/v1/pace/:position", async (c) => {
    const position = c.req.param("position").toUpperCase();
    if (!POSITIONS.has(position)) badRequest("Unsupported position");
    const championParam = c.req.query("champion");
    const championId = championParam === undefined ? null : Number(championParam);
    if (championId !== null && (!Number.isInteger(championId) || championId <= 0)) badRequest("Invalid champion id");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json(await paceFor(position, championId));
  });

  // Queues without roles (ARAM, Arena, URF) use ALL.
  app.get("/v1/tierlist/:position", async (c) => {
    const queue = queueOf(c.req.query("queue"));
    const position = c.req.param("position").toUpperCase();
    if (queue === 420 ? !POSITIONS.has(position) : position !== "ALL") badRequest("Unsupported position");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const list = await readDoc(statsDb, docKey.tierList(queue, position));
    return c.json(list ?? { patches: [], games: 0, champions: [] });
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
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    // A role the champion has no games in gets its most played role, as championOverview does.
    const overview =
      (await readDoc(statsDb, docKey.champion(queue, championId, queue === 420 ? position : null))) ??
      (position ? await readDoc(statsDb, docKey.champion(queue, championId, null)) : null);
    if (!overview) return c.json({ error: "No games for this champion yet" }, 404);
    return c.json(overview);
  });

  app.get("/v1/champions/:championId/counters", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.counters(championId, position))) ?? { patches: [], games: 0, matchups: [] });
  });

  app.get("/v1/champions/:championId/synergies", async (c) => {
    const { championId, position } = championRequest(c);
    if (!position) badRequest("position is required");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.synergies(championId, position))) ?? { patches: [], games: 0, allies: [] });
  });

  // Riot's policy forbids Arena augment win rates without written approval.
  app.get("/v1/champions/:championId/arena-augments", async (c) => {
    const { championId } = championRequest(c);
    if (!arenaAugments) return c.json({ error: "Arena augment stats are not enabled" }, 403);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.arenaAugments(championId))) ?? { patches: [], games: 0, augments: [] });
  });

  app.get("/v1/mayhem/augments", async (c) => {
    if (!mayhemAugments) return c.json({ error: "ARAM Mayhem augment stats are not enabled" }, 403);
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.mayhemAugments())) ?? { patches: [], games: 0, augments: [] });
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
    if (group !== undefined && group !== "worlds" && group !== "turkey") badRequest("Unsupported group");
    const limit = Number(c.req.query("limit") ?? 30);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) badRequest("limit must be 1-100");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const key = `pro-builds:${championId ?? "ANY"}:${position ?? "ANY"}:${team ?? "ANY"}:${group ?? "ANY"}:${limit}`;
    // Pro games arrive every few minutes; a short cache keeps the list fresh.
    const load = async () => {
      // A Data Dragon outage costs the style labels, not the list.
      const items = catalog ? await catalog().catch(() => null) : null;
      return proBuilds(statsDb, { championId, position, team, group, limit }, items);
    };
    return c.json({ builds: await cached(key, 5 * MINUTE, load) });
  });

  app.get("/v1/pros/teams", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json({ teams: await cached("pro-teams", 60 * MINUTE, () => proTeams(statsDb)) });
  });

  app.get("/v1/bans", async (c) => {
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json((await readDoc(statsDb, docKey.bans())) ?? { patches: [], champions: [] });
  });

  const matchById = async (matchId: string): Promise<Match | null> => {
    const stored = await store.getMatch(matchId);
    if (stored) return stored;
    const match = await riot.get<Match>(regionOfMatch(matchId), "/lol/match/v5/matches", `/lol/match/v5/matches/${matchId}`);
    if (match) await store.putMatch(match);
    return match;
  };

  app.get("/v1/players/:puuid/champions", async (c) => {
    const { puuid } = c.req.param();
    if (!PUUID.test(puuid)) badRequest("Invalid PUUID");
    const pool = await cached(`champion-pool:${puuid}`, 30 * MINUTE, async () => {
      const ids =
        (await riot.get<string[]>(
          "europe",
          "/lol/match/v5/matches/by-puuid/ids",
          `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=20`,
        )) ?? [];
      const matches: Match[] = [];
      // Match documents are stored once, so a second player sharing a game costs nothing.
      for (const id of ids) {
        const match = await matchById(id);
        if (match) matches.push(match);
      }
      return { games: matches.length, champions: championPool(matches, puuid) };
    });
    return c.json(pool);
  });

  app.get("/v1/players/:puuid/lp", async (c) => {
    const { puuid } = c.req.param();
    if (!PUUID.test(puuid)) badRequest("Invalid PUUID");
    const queue = c.req.query("queue") ?? "RANKED_SOLO_5x5";
    if (queue !== "RANKED_SOLO_5x5" && queue !== "RANKED_FLEX_SR") badRequest("Unsupported queue");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    return c.json({ snapshots: await lpHistory(statsDb, puuid, queue) });
  });

  app.get("/v1/players/:puuid/trends", async (c) => {
    const { puuid } = c.req.param();
    if (!PUUID.test(puuid)) badRequest("Invalid PUUID");
    const trends = await cached(`trends:${puuid}`, 30 * MINUTE, async () => {
      const ids =
        (await riot.get<string[]>(
          "europe",
          "/lol/match/v5/matches/by-puuid/ids",
          `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=10`,
        )) ?? [];
      const games = [];
      for (const id of ids) {
        const match = await matchById(id);
        const numbers = match && gameNumbers(match, puuid);
        if (numbers) games.push(numbers);
      }
      const positions = [...new Set(games.map((g) => g.position))];
      const benches = new Map<string, Benchmarks>();
      for (const position of positions) {
        const bench = await benchmarksFor(position);
        if (bench) benches.set(position, bench);
      }
      return findHabits(games, benches);
    });
    return c.json(trends);
  });

  app.get("/v1/matches/:matchId/graph", async (c) => {
    const { matchId } = c.req.param();
    if (!MATCH_ID.test(matchId)) badRequest("Invalid match ID");
    const match = await matchById(matchId);
    if (!match) return c.json({ error: "Match not found" }, 404);
    const graph = await cached(`graph:${matchId}`, Infinity, async () => {
      const timeline = await riot.get<FullTimeline>(
        regionOfMatch(matchId),
        "/lol/match/v5/matches/timeline",
        `/lol/match/v5/matches/${matchId}/timeline`,
      );
      if (!timeline) return null;
      const teams = new Map(match.info.participants.map((p) => [p.participantId ?? 0, p.teamId ?? 0]));
      return goldGraph(timeline, (id) => teams.get(id) ?? 0);
    });
    if (!graph) return c.json({ error: "Timeline not found" }, 404);
    return c.json(graph);
  });

  // The post-game report card: category scores and the early CS curve
  // against Emerald+ players on the same champion and role.
  app.get("/v1/matches/:matchId/report", async (c) => {
    const { matchId } = c.req.param();
    if (!MATCH_ID.test(matchId)) badRequest("Invalid match ID");
    const puuid = c.req.query("puuid") ?? "";
    if (!PUUID.test(puuid)) badRequest("Invalid PUUID");
    if (!statsDb) return c.json({ error: "Stats are not available" }, 503);
    const match = await matchById(matchId);
    if (!match) return c.json({ error: "Match not found" }, 404);
    const game = gameNumbers(match, puuid);
    if (!game) return c.json({ error: "No role in this game to compare against" }, 404);

    const report = await cached(`report:${matchId}:${puuid}`, 6 * 60 * MINUTE, async () => {
      const [bench, curve, timeline] = await Promise.all([
        benchmarksFor(game.position, game.championId),
        paceFor(game.position, game.championId),
        riot.get<FullTimeline>(regionOfMatch(matchId), "/lol/match/v5/matches/timeline", `/lol/match/v5/matches/${matchId}/timeline`),
      ]);
      const participantId = match.info.participants.find((p) => p.puuid === puuid)?.participantId;
      const mine = timeline && participantId ? (csByMinute(timeline).get(participantId) ?? []) : [];
      const median = curve.median.slice(0, mine.length);
      return {
        position: game.position,
        championId: game.championId,
        // Whether the scores compare against the champion or, short of games, the whole role.
        comparedTo: bench?.championId ? "champion" : "role",
        ...(bench ? scoreGame(game, bench) : { overall: null, scores: [] }),
        cs: { mine, median, weakest: weakestMinutes(mine, median) },
      };
    });
    return c.json(report);
  });

  app.post("/v1/coach/:matchId", async (c) => {
    const { matchId } = c.req.param();
    if (!MATCH_ID.test(matchId)) badRequest("Invalid match ID");
    const body = (await c.req.json().catch(() => null)) as { puuid?: unknown } | null;
    const puuid = typeof body?.puuid === "string" ? body.puuid : "";
    if (!PUUID.test(puuid)) badRequest("Invalid PUUID");

    const useClaude = claude?.allowedPuuids.has(puuid) ?? false;
    const key = `coach:${useClaude ? "claude" : "free"}:${matchId}:${puuid}`;
    const done = await store.getCached<CoachResult>(key);
    if (done) return c.json(done);

    const today = new Date().toISOString().slice(0, 10);
    const counterKey = `coach-count:${useClaude ? "claude" : "rewrite"}:${today}`;
    const used = (await store.getCached<number>(counterKey)) ?? 0;
    if (useClaude && used >= claude!.dailyLimit) return c.json({ error: "Daily coaching limit reached" }, 429);

    let match = (await store.getMatch(matchId)) as CoachMatch | undefined;
    if (!match) {
      const fetched = await riot.get<Match>(regionOfMatch(matchId), "/lol/match/v5/matches", `/lol/match/v5/matches/${matchId}`);
      if (!fetched) return c.json({ error: "Match not found" }, 404);
      await store.putMatch(fetched);
      match = fetched as unknown as CoachMatch;
    }
    const timeline = await riot.get<Timeline>(
      regionOfMatch(matchId),
      "/lol/match/v5/matches/timeline",
      `/lol/match/v5/matches/${matchId}/timeline`,
    );
    if (!timeline) return c.json({ error: "Timeline not found" }, 404);
    const summary = summarize(match, timeline, puuid);
    if (!summary) return c.json({ error: "Player is not in this match" }, 404);

    let result: CoachResult;
    if (useClaude) {
      await store.putCached(counterKey, used + 1, 2 * 24 * 60 * MINUTE);
      result = { ...(await coach(claude!.client, summary)), source: "claude" };
    } else {
      const rules = coachByRules(summary, await benchmarksFor(summary.position));
      let rewritten: Coaching | null = null;
      if (ai && used < FREE_REWRITES_PER_DAY && rules.points.length > 0) {
        await store.putCached(counterKey, used + 1, 2 * 24 * 60 * MINUTE);
        rewritten = await rewriteWithWorkersAi(ai, rules);
      }
      result = rewritten ? { ...rewritten, source: "workers-ai" } : { ...rules, source: "rules" };
    }
    // Rule-only results are kept briefly so a later request can still get the
    // reworded version once Workers AI answers again.
    await store.putCached(key, result, result.source === "rules" ? 6 * 60 * MINUTE : Infinity);
    return c.json(result);
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
