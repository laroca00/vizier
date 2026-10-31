import type { Hono } from "hono";
import { createApp } from "./app.ts";
import { RiotClient } from "./riot/client.ts";
import { D1Store } from "./store.ts";

type Env = { DB: D1Database; RIOT_API_KEY?: string };

// Kept for the life of the isolate so the rate limiter remembers its counts.
// Isolates come and go, so the limiter is best effort; Riot's headers resync it.
let app: Hono | undefined;

export default {
  fetch(request, env, ctx) {
    if (!env.RIOT_API_KEY) return Response.json({ error: "RIOT_API_KEY is not set" }, { status: 500 });
    app ??= createApp(new RiotClient({ apiKey: env.RIOT_API_KEY }), new D1Store(env.DB));
    return app.fetch(request, env, ctx);
  },

  async scheduled(_controller, env) {
    await new D1Store(env.DB).purgeExpired();
  },
} satisfies ExportedHandler<Env>;
