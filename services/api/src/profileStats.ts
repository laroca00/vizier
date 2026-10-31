import type { LeagueEntry, Match } from "./riot/types.ts";

export type PoolEntry = { championId: number; games: number; wins: number; kills: number; deaths: number; assists: number };

/** The champions a player used in these games, most played first. */
export function championPool(matches: Match[], puuid: string): PoolEntry[] {
  const pool = new Map<number, PoolEntry>();
  for (const match of matches) {
    const p = match.info.participants.find((x) => x.puuid === puuid);
    if (!p) continue;
    const entry = pool.get(p.championId) ?? { championId: p.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
    entry.games++;
    entry.wins += p.win ? 1 : 0;
    entry.kills += p.kills ?? 0;
    entry.deaths += p.deaths ?? 0;
    entry.assists += p.assists ?? 0;
    pool.set(p.championId, entry);
  }
  return [...pool.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
}

const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"];
const DIVISIONS = ["IV", "III", "II", "I"];
const APEX_BASE = TIER_ORDER.length * 400;

/** One number per rank so LP changes across divisions plot on one line: Iron IV 0 LP is 0, Master 0 LP is 2800. */
export function ladderPoints(tier: string, rank: string, lp: number): number {
  const index = TIER_ORDER.indexOf(tier);
  if (index < 0) return APEX_BASE + lp;
  return index * 400 + Math.max(0, DIVISIONS.indexOf(rank)) * 100 + lp;
}

export type LpSnapshot = { queue: string; tier: string; rank: string; lp: number; wins: number; losses: number; at: number };

/** Records each ranked queue's standing when it changed since the last snapshot. */
export async function recordLp(db: D1Database, puuid: string, ranks: LeagueEntry[], now = Date.now()): Promise<number> {
  let written = 0;
  for (const r of ranks) {
    const last = await db
      .prepare("SELECT tier, rank, lp, wins, losses FROM lp_snapshots WHERE puuid = ? AND queue = ? ORDER BY at DESC LIMIT 1")
      .bind(puuid, r.queueType)
      .first<{ tier: string; rank: string; lp: number; wins: number; losses: number }>();
    // Games played is the honest signal; LP alone can stay put across a win and a loss.
    if (last && last.wins === r.wins && last.losses === r.losses && last.tier === r.tier && last.rank === r.rank && last.lp === r.leaguePoints) continue;
    await db
      .prepare("INSERT INTO lp_snapshots (puuid, queue, tier, rank, lp, wins, losses, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(puuid, r.queueType, r.tier, r.rank, r.leaguePoints, r.wins, r.losses, now)
      .run();
    written++;
  }
  return written;
}

export async function lpHistory(db: D1Database, puuid: string, queue: string): Promise<(LpSnapshot & { points: number })[]> {
  const { results } = await db
    .prepare("SELECT queue, tier, rank, lp, wins, losses, at FROM lp_snapshots WHERE puuid = ? AND queue = ? ORDER BY at")
    .bind(puuid, queue)
    .all<LpSnapshot>();
  return results.map((s) => ({ ...s, points: ladderPoints(s.tier, s.rank, s.lp) }));
}
