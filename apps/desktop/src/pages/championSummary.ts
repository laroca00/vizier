import type { Build, Counters } from "../api";
import { confidenceOf } from "../data/confidence";

export type SummaryMatchup = { championId: number; winRate: number; games: number };

export type ChampionSummary = {
  keystone: number | null;
  core: number[];
  /** Q, W, E as 1, 2, 3 in the order they are maxed. */
  maxOrder: number[];
  hardest: SummaryMatchup | null;
  easiest: SummaryMatchup | null;
};

/**
 * The page in one glance: the keystone, the first three core items, the skill
 * max order, and the hardest and easiest lane opponent. Matchups count only
 * when the sample passes the confidence rule and the result is off even.
 */
export function championSummary(build: Build | null, counters: Counters | null): ChampionSummary | null {
  if (!build) return null;
  const readable = (counters?.matchups ?? []).filter((m) => confidenceOf({ games: m.games, winRate: m.winRate, patches: counters?.patches }) !== "insufficient");
  const byRate = [...readable].sort((a, b) => a.winRate - b.winRate);
  const hardest = byRate[0] && byRate[0].winRate < 0.5 ? byRate[0] : null;
  const top = byRate[byRate.length - 1];
  const easiest = top && top.winRate > 0.5 && top !== hardest ? top : null;
  return {
    keystone: build.runes[0]?.perks[0] ?? null,
    core: (build.coreItems?.ids ?? build.items.map((i) => i.id)).slice(0, 3),
    maxOrder: build.skills?.maxOrder ?? [],
    hardest: hardest ? { championId: hardest.championId, winRate: hardest.winRate, games: hardest.games } : null,
    easiest: easiest ? { championId: easiest.championId, winRate: easiest.winRate, games: easiest.games } : null,
  };
}
