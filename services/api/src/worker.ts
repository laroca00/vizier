import Anthropic from "@anthropic-ai/sdk";
import { ProCrawler, pruneOldProMatches } from "./pros.ts";
import type { Hono } from "hono";
import { createApp, type CoachConfig } from "./app.ts";
import { Crawler, pruneOldPatches } from "./crawler.ts";
import { RiotClient } from "./riot/client.ts";
import { D1Store } from "./store.ts";

type Env = {
  DB: D1Database;
  AI?: Ai;
  UPDATES?: KVNamespace;
  RIOT_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  /** Comma-separated PUUIDs allowed to request coaching. */
  COACH_PUUIDS?: string;
  /** "approved" once Riot has confirmed in writing that Arena augment stats may be shown. */
  ARENA_AUGMENTS?: string;
  /** "on" once Riot has said ARAM Mayhem augment stats may be shown. */
  MAYHEM_AUGMENTS?: string;
};

const COACH_DAILY_LIMIT = 20;

function coachFor(env: Env): CoachConfig | undefined {
  const allowed = (env.COACH_PUUIDS ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!env.ANTHROPIC_API_KEY || allowed.length === 0) return undefined;
  return {
    client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
    allowedPuuids: new Set(allowed),
    dailyLimit: COACH_DAILY_LIMIT,
  };
}

const DAILY_CRON = "0 4 * * *";

// Kept for the life of the isolate so the rate limiter remembers its counts.
// Isolates come and go, so the limiter is best effort; Riot's headers resync it.
let riot: RiotClient | undefined;
let app: Hono | undefined;

function riotFor(env: Env) {
  if (!env.RIOT_API_KEY) return undefined;
  riot ??= new RiotClient({ apiKey: env.RIOT_API_KEY });
  return riot;
}

/** latest.json and the installers it points at; the files are signed, so serving them needs no auth. */
async function serveUpdate(env: Env, name: string): Promise<Response> {
  if (!env.UPDATES || !/^[\w.-]+$/.test(name)) return new Response("Not found", { status: 404 });
  const body = await env.UPDATES.get(name, "arrayBuffer");
  if (!body) return new Response("Not found", { status: 404 });
  const type = name.endsWith(".json") ? "application/json" : "application/octet-stream";
  // latest.json changes on every release; installers never change once uploaded.
  const cache = name === "latest.json" ? "no-cache" : "public, max-age=31536000, immutable";
  return new Response(body, { headers: { "content-type": type, "cache-control": cache } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/updates/")) return serveUpdate(env, url.pathname.slice("/updates/".length));
    const client = riotFor(env);
    if (!client) return Response.json({ error: "RIOT_API_KEY is not set" }, { status: 500 });
    app ??= createApp(client, new D1Store(env.DB), { statsDb: env.DB, claude: coachFor(env), ai: env.AI, arenaAugments: env.ARENA_AUGMENTS === "approved",
      mayhemAugments: env.MAYHEM_AUGMENTS === "on",
    });
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env) {
    const client = riotFor(env);
    if (controller.cron === DAILY_CRON) {
      await new D1Store(env.DB).purgeExpired();
      await pruneOldPatches(env.DB);
      await pruneOldProMatches(env.DB);
      // Pros change accounts; the list in proPlayers.ts is re-resolved daily.
      if (client) await new ProCrawler(env.DB, client).syncAccounts();
      return;
    }
    if (!client) return;
    const result = await new Crawler(env.DB, client).run();
    const pros = await new ProCrawler(env.DB, client).run();
    console.log(`crawl: seeded ${result.seeded}, saved ${result.matches} matches and ${pros} pro games`);
  },
} satisfies ExportedHandler<Env>;
