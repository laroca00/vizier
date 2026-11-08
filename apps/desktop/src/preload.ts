import { getBans, getBuild, getTierList } from "./api";
import { champions, items, latestVersion, runes, summonerSpells } from "./data/ddragon";
import type { PoolPick } from "./personal";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const MAX_BUILDS = 6;
/** Phases before champ select, when there is time to fetch what it will need. */
const QUEUE_PHASES = ["Lobby", "Matchmaking", "ReadyCheck"];

export type PreloadPlan = { roles: string[]; builds: { championId: number; position: string | null }[] };

/** Roles with tier lists to fetch (the pool's, or all five without a pool) and the pool's builds. */
export function planPreload(pool: PoolPick[]): PreloadPlan {
  const poolRoles = [...new Set(pool.map((p) => p.position).filter((r): r is string => !!r && ROLES.includes(r)))];
  const seen = new Set<string>();
  const builds = pool
    .filter((p) => {
      const key = `${p.championId}:${p.position}`;
      return !seen.has(key) && seen.add(key);
    })
    .sort((a, b) => Number(b.rank === "main") - Number(a.rank === "main"))
    .slice(0, MAX_BUILDS)
    .map((p) => ({ championId: p.championId, position: p.position }));
  return { roles: poolRoles.length ? poolRoles : ROLES, builds };
}

/** True on the step from outside the queue flow into it. */
export function enteredQueueFlow(previous: string | null, next: string | null): boolean {
  return !!next && QUEUE_PHASES.includes(next) && !(previous && QUEUE_PHASES.includes(previous));
}

/** Warms the caches champ select reads; failures are ignored, champ select asks again if it needs the data. */
export function runPreload(plan: PreloadPlan) {
  const quiet = (work: Promise<unknown>) => work.catch(() => {});
  void quiet(Promise.all([latestVersion(), champions(), items(), runes(), summonerSpells()]));
  void quiet(getBans());
  for (const role of plan.roles) void quiet(getTierList(role));
  for (const build of plan.builds) void quiet(getBuild(build.championId, build.position));
}
