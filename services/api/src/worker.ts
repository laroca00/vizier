import { pruneOldProMatches } from "./pros.ts";
import type { Hono } from "hono";
import { createApp } from "./app.ts";
import { loadCatalog } from "./ddragon.ts";
import { pruneOldPatches } from "./crawler.ts";
import { D1Store } from "./store.ts";

type Env = {
  DB: D1Database;
  UPDATES?: KVNamespace;
  /** "on" serves Arena and ARAM Mayhem augment stats; anything else hides them at once. */
  AUGMENTS?: string;
};

const DAILY_CRON = "0 4 * * *";

let app: Hono | undefined;

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
    app ??= createApp(new D1Store(env.DB), { statsDb: env.DB, catalog: () => loadCatalog(), augments: env.AUGMENTS === "on" });
    return app.fetch(request, env, ctx);
  },

  // Ranked and pro games are crawled by services/crawler, which publishes
  // stat_docs and pro_matches here; the Worker only tidies up.
  async scheduled(controller, env) {
    if (controller.cron !== DAILY_CRON) return;
    await new D1Store(env.DB).purgeExpired();
    await pruneOldPatches(env.DB);
    await pruneOldProMatches(env.DB);
  },
} satisfies ExportedHandler<Env>;
