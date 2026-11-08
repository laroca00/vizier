// Read-only check of which queue ids have games right now, for when a mode
// moves to a new queue (Arena went from 1700 to 1750). Writes nothing.
// Usage:
//   node src/probeQueues.ts [platform] [queue ...]     asks Challenger players about each queue
//   node src/probeQueues.ts [platform] "Name#TAG"      lists one player's latest games with their queue
import { readFileSync } from "node:fs";
import { env, argv } from "node:process";

const DEFAULT_QUEUES = [2400, 2401, 2403, 2405, 2410, 2450, 450, 1700, 1750];
const ROUTING: Record<string, string> = { euw1: "europe", tr1: "europe", eun1: "europe", kr: "asia", na1: "americas" };
const PLAYERS = 12;
const LATEST = 15;

const key = env.RIOT_API_KEY_FILE ? readFileSync(env.RIOT_API_KEY_FILE, "utf8").trim() : env.RIOT_API_KEY;
if (!key) throw new Error("Set RIOT_API_KEY_FILE or RIOT_API_KEY");
const platform = argv[2] ?? "euw1";
const routing = ROUTING[platform];
if (!routing) throw new Error(`Unknown platform ${platform}`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get<T>(host: string, path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://${host}.api.riotgames.com${path}`, { headers: { "X-Riot-Token": key! } });
    if (res.status === 429) {
      await sleep((Number(res.headers.get("retry-after")) || 10) * 1000);
      continue;
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(`Riot answered ${res.status}: the key is missing, expired or not allowed`);
      return null;
    }
    return (await res.json()) as T;
  }
  return null;
}

type Match = { info: { queueId: number; gameMode: string; mapId: number; gameStartTimestamp: number; participants: Record<string, unknown>[] } };

const hasAugments = (match: Match | null) => {
  const p = match?.info.participants[0] ?? {};
  return [1, 2, 3, 4, 5, 6].some((n) => p[`playerAugment${n}`]);
};
const day = (ms: number | undefined) => (ms ? new Date(ms).toISOString().slice(0, 10) : "?");

const riotId = argv[3]?.includes("#") ? argv[3] : null;

if (riotId) {
  // One player's latest games of any queue, so a queue id we don't know yet still shows up.
  const [name, tag] = riotId.split("#");
  const account = await get<{ puuid: string }>(routing, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
  if (!account) throw new Error(`No account ${riotId} on ${routing}`);
  const ids = (await get<string[]>(routing, `/lol/match/v5/matches/by-puuid/${account.puuid}/ids?count=${LATEST}`)) ?? [];
  console.log(`${riotId}: latest ${ids.length} games`);
  for (const id of ids) {
    const match = await get<Match>(routing, `/lol/match/v5/matches/${id}`);
    console.log(`${id}: queue ${match?.info.queueId ?? "?"}, gameMode ${match?.info.gameMode ?? "?"}, map ${match?.info.mapId ?? "?"}, ${day(match?.info.gameStartTimestamp)}, augments ${hasAugments(match) ? "yes" : "no"}`);
    await sleep(1300);
  }
} else {
  const queues = argv.length > 3 ? argv.slice(3).map(Number) : DEFAULT_QUEUES;
  const ladder = await get<{ entries: { puuid: string }[] }>(platform, "/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5");
  const players = (ladder?.entries ?? []).slice(0, PLAYERS).map((e) => e.puuid);
  console.log(`${platform}: asking ${players.length} Challenger players about ${queues.length} queues; results come at the end`);

  const found = new Map<number, string[]>(queues.map((q) => [q, []]));
  for (const puuid of players) {
    for (const queue of queues) {
      const ids = await get<string[]>(routing, `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&count=5`);
      found.get(queue)!.push(...(ids ?? []));
      // Stays well under a development key's 100 requests per two minutes.
      await sleep(1300);
    }
  }

  for (const [queue, ids] of found) {
    if (ids.length === 0) {
      console.log(`${queue}: no games`);
      continue;
    }
    const match = await get<Match>(routing, `/lol/match/v5/matches/${ids[0]}`);
    console.log(`${queue}: ${ids.length} games, newest ${day(match?.info.gameStartTimestamp)}, gameMode ${match?.info.gameMode ?? "?"}, map ${match?.info.mapId ?? "?"}, augments ${hasAugments(match) ? "yes" : "no"}`);
    await sleep(1300);
  }
}
