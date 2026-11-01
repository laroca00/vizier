// Crawls ranked games around the clock, rolls them up and publishes the
// finished stats to the Worker's D1. Runs on a server of its own because
// the Worker's free plan caps requests, CPU time and writes per run.
import { readFileSync } from "node:fs";
import { Crawler, type CrawlOptions } from "../../api/src/crawler.ts";
import { RiotClient, RiotError } from "../../api/src/riot/client.ts";
import { RateLimiter } from "../../api/src/riot/rateLimiter.ts";
import { pruneRaw, rollup } from "../../api/src/rollup.ts";
import { sqliteD1 } from "../../api/src/sqliteD1.ts";
import { D1Http } from "./d1Http.ts";
import { publish } from "./publish.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ROLLUP_EVERY = 5 * MINUTE;
const PRUNE_EVERY = 6 * HOUR;
// Each publish rewrites most docs; every 4 hours keeps D1's free 100k daily writes for the Worker.
const PUBLISH_EVERY = 4 * HOUR;
// No new games among the players due: wait for them to play some.
const IDLE_WAIT = 5 * MINUTE;
const ERROR_WAIT = MINUTE;
// A development key expires daily; checked again after this.
const BAD_KEY_WAIT = 10 * MINUTE;

// About 70 Riot calls a run. The share of the key below paces that to
// roughly one run per two minutes per region on a development key.
const RUN_SIZE = { playersPerRun: 4, matchesPerRun: 40, extraMatchesPerRun: 4, timelinesPerRun: 20 };
const REGIONS: CrawlOptions[] = [
  { region: "europe", platforms: ["tr1", "euw1"], leagues: "emerald+", ...RUN_SIZE },
  { region: "asia", platforms: ["kr"], leagues: "challenger", ...RUN_SIZE },
];

const env = process.env;
// Riot limits are per key; this leaves the rest for the Worker's own calls.
const share = Number(env.RIOT_SHARE ?? 0.7);
const { db, sqlite } = sqliteD1(env.VIZIER_DB ?? "vizier-crawler.db");
const remote =
  env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_D1_DATABASE_ID
    ? new D1Http(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_D1_DATABASE_ID, env.CLOUDFLARE_API_TOKEN)
    : null;

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The key file is read again on every run, so a renewed key needs no restart. */
function riotKey(): string {
  const file = env.RIOT_API_KEY_FILE;
  const key = file ? readFileSync(file, "utf8").trim() : env.RIOT_API_KEY;
  if (!key) throw new Error("Set RIOT_API_KEY_FILE or RIOT_API_KEY");
  return key;
}

let riot: { key: string; client: RiotClient } | null = null;
function riotClient(): RiotClient {
  const key = riotKey();
  if (riot?.key !== key) riot = { key, client: new RiotClient({ apiKey: key, limiter: new RateLimiter({ appShare: share }) }) };
  return riot.client;
}

async function crawl(options: CrawlOptions) {
  for (;;) {
    try {
      const { seeded, matches } = await new Crawler(db, riotClient(), Date.now, options).run();
      if (seeded > 0) log(`${options.region}: seeded ${seeded} players`);
      log(`${options.region}: saved ${matches} games`);
      if (matches === 0) await sleep(IDLE_WAIT);
    } catch (error) {
      if (error instanceof RiotError && (error.status === 401 || error.status === 403)) {
        log(`${options.region}: Riot rejected the API key; put a new one in the key file`);
        await sleep(BAD_KEY_WAIT);
      } else {
        log(`${options.region}: ${error instanceof Error ? error.message : error}`);
        await sleep(ERROR_WAIT);
      }
    }
  }
}

/** Runs `task` now and then every `ms`, logging failures instead of stopping. */
function every(ms: number, name: string, task: () => Promise<string>) {
  const run = () =>
    task().then(
      (message) => log(`${name}: ${message}`),
      (error) => log(`${name} failed: ${error instanceof Error ? error.message : error}`),
    );
  void run();
  setInterval(run, ms);
}

if (!remote) log("CLOUDFLARE_* is not set; stats are computed but not published");
for (const options of REGIONS) void crawl(options);
every(ROLLUP_EVERY, "rollup", async () => `${await rollup(db)} rows`);
every(PRUNE_EVERY, "prune", async () => {
  await pruneRaw(db);
  return "done";
});
if (remote) {
  // The first publish waits for a rollup so it isn't empty after a fresh start.
  setTimeout(
    () =>
      every(PUBLISH_EVERY, "publish", async () => {
        const { total, sent } = await publish(db, sqlite, remote);
        return `${sent} of ${total} docs changed`;
      }),
    ROLLUP_EVERY + MINUTE,
  );
}
