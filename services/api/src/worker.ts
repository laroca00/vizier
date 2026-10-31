import Anthropic from "@anthropic-ai/sdk";
import type { Hono } from "hono";
import { createApp, type CoachConfig } from "./app.ts";
import { Crawler, pruneOldPatches } from "./crawler.ts";
import { RiotClient } from "./riot/client.ts";
import { D1Store } from "./store.ts";

type Env = {
  DB: D1Database;
  AI?: Ai;
  RIOT_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  /** Comma-separated PUUIDs allowed to request coaching. */
  COACH_PUUIDS?: string;
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

export default {
  fetch(request, env, ctx) {
    const client = riotFor(env);
    if (!client) return Response.json({ error: "RIOT_API_KEY is not set" }, { status: 500 });
    app ??= createApp(client, new D1Store(env.DB), { statsDb: env.DB, claude: coachFor(env), ai: env.AI });
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env) {
    if (controller.cron === DAILY_CRON) {
      await new D1Store(env.DB).purgeExpired();
      await pruneOldPatches(env.DB);
      return;
    }
    const client = riotFor(env);
    if (!client) return;
    const result = await new Crawler(env.DB, client).run();
    console.log(`crawl: seeded ${result.seeded}, saved ${result.matches} matches`);
  },
} satisfies ExportedHandler<Env>;
