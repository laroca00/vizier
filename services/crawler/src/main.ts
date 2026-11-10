// Crawls ranked games around the clock, rolls them up and publishes the
// finished stats to the Worker's D1. Runs on a server of its own because
// the Worker's free plan caps requests, CPU time and writes per run.
import { readFileSync } from "node:fs";
import { coverage } from "../../api/src/coverage.ts";
import { Crawler, type CrawlOptions } from "../../api/src/crawler.ts";
import { GroupBudget } from "../../api/src/groupBudget.ts";
import { ProCrawler, syncChallengers } from "../../api/src/pros.ts";
import { RiotClient, RiotError } from "../../api/src/riot/client.ts";
import { RateLimiter } from "../../api/src/riot/rateLimiter.ts";
import { pruneRaw, rollup } from "../../api/src/rollup.ts";
import { snapshotClosedPatch } from "../../api/src/snapshots.ts";
import { recordHistory } from "../../api/src/history.ts";
import { sqliteD1 } from "../../api/src/sqliteD1.ts";
import { D1Http } from "./d1Http.ts";
import { publishTick } from "./publish.ts";
import { publishPros } from "./publishPros.ts";

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
// One pro or challenger account per run, up to five calls; ~300 accounts come round every couple of hours.
const PRO_WAIT = 20_000;
const PRO_PUBLISH_EVERY = 10 * MINUTE;
const DAY = 24 * HOUR;

// About 70 Riot calls a run. The share of the key below paces that to
// roughly one run per two minutes per region on a development key.
const RUN_SIZE = { playersPerRun: 4, matchesPerRun: 40, extraMatchesPerRun: 4, timelinesPerRun: 20 };
const REGIONS: CrawlOptions[] = [
  { region: "europe", platforms: ["tr1", "euw1"], leagues: "all", ...RUN_SIZE },
  { region: "asia", platforms: ["kr"], leagues: "all", ...RUN_SIZE },
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

async function crawl(options: CrawlOptions, budget: GroupBudget) {
  for (;;) {
    try {
      const { seeded, matches } = await new Crawler(db, riotClient(), Date.now, options, budget).run();
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

async function crawlPros() {
  for (;;) {
    try {
      const saved = await new ProCrawler(db, riotClient()).run();
      if (saved > 0) log(`pros: saved ${saved} games`);
    } catch (error) {
      log(`pros: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(PRO_WAIT);
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
const budgets = new Map(REGIONS.map((options) => [options.region, new GroupBudget()]));
for (const options of REGIONS) void crawl(options, budgets.get(options.region)!);
// Where each host spent its calls this hour, by tier group.
every(HOUR, "budget", async () => [...budgets].map(([region, budget]) => `${region}: ${budget.takeLine()}`).join(" | "));
void crawlPros();
// Pros change accounts and the ladders move, so both lists are re-read daily.
every(DAY, "pro accounts", async () => {
  const pros = await new ProCrawler(db, riotClient()).syncAccounts();
  const challengers = await syncChallengers(db, riotClient());
  return `${pros} pro accounts, ${challengers} challengers`;
});
// One line an hour so thin data shows in the log before it shows in the app.
every(HOUR, "coverage", async () => {
  const report = await coverage(db);
  const newest = report.patches[0];
  if (!newest) return "no games yet";
  const ranked = report.timeline.find((t) => t.patch === newest && t.queue === 420);
  const queues = report.games.filter((g) => g.patch === newest).map((g) => `${g.queue}:${g.games}`).join(" ");
  const regions = report.players.map((p) => `${p.region}/${p.source}:${p.players}`).join(" ");
  return `patch ${newest} games ${queues}; ranked timelines ${ranked?.share === null || !ranked ? "n/a" : `${Math.round(ranked.share * 100)}%`}; players ${regions}`;
});
every(ROLLUP_EVERY, "rollup", async () => {
  const rows = await rollup(db);
  // The closed patch's builds are kept once, while its counts still exist.
  const snapshots = await snapshotClosedPatch(db);
  const points = await recordHistory(db);
  return `${rows} rows${snapshots ? `, ${snapshots} build snapshots` : ""}${points ? `, ${points} history points` : ""}`;
});
every(PRUNE_EVERY, "prune", async () => {
  await pruneRaw(db);
  return "done";
});
if (remote) {
  every(PRO_PUBLISH_EVERY, "pro publish", async () => {
    const { games, accounts } = await publishPros(sqlite, remote);
    return `${games} games${accounts ? `, ${accounts} accounts` : ""}`;
  });
  // The first publish waits for a rollup so it isn't empty after a fresh start.
  setTimeout(
    () =>
      every(PUBLISH_EVERY, "publish", async () => {
        const { total, sent, extra, held } = await publishTick(db, sqlite, remote);
        return `${sent} of ${total} docs changed${extra ? ` (with ${extra})` : ""}${held.length ? `; HELD: ${held.join("; ")}` : ""}`;
      }),
    ROLLUP_EVERY + MINUTE,
  );
}
