import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { RiotClient } from "./riot/client.ts";

const apiKey = process.env.RIOT_API_KEY;
if (!apiKey) {
  console.error("RIOT_API_KEY is not set. Copy .env.example to .env and add a key.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8787);
const app = createApp(new RiotClient({ apiKey }));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
