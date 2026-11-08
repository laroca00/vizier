import type { TierEntry } from "../api";

export type BenchSource = "current" | "bench" | "ally";

export type BenchRow = {
  championId: number;
  source: BenchSource;
  /** Null when the ARAM tier list has too few games for the champion. */
  winRate: number | null;
  games: number;
  tier: string | null;
  /** A bench champion clearly better than the current one. */
  take: boolean;
};

export const MIN_BENCH_GAMES = 150;
/** Win rate lead over the current champion before the bench is worth a swap. */
export const TAKE_MARGIN = 0.02;

type Input = {
  tierList: TierEntry[];
  current: number;
  bench: number[];
  allies: number[];
};

/** The player's champion, the bench and the allies, best ARAM win rate first; thin samples sink to the bottom. */
export function rankBench({ tierList, current, bench, allies }: Input): BenchRow[] {
  const byChampion = new Map(tierList.map((e) => [e.championId, e]));
  const seen = new Set<number>();
  const rows: BenchRow[] = [];
  const add = (championId: number, source: BenchSource) => {
    if (championId <= 0 || seen.has(championId)) return;
    seen.add(championId);
    const entry = byChampion.get(championId);
    const known = entry && entry.games >= MIN_BENCH_GAMES;
    rows.push({ championId, source, winRate: known ? entry.winRate : null, games: entry?.games ?? 0, tier: known ? entry.tier : null, take: false });
  };
  add(current, "current");
  bench.forEach((id) => add(id, "bench"));
  allies.forEach((id) => add(id, "ally"));

  const mine = rows.find((r) => r.source === "current");
  if (mine?.winRate != null) {
    const best = rows
      .filter((r) => r.source === "bench" && r.winRate !== null && r.winRate - mine.winRate! >= TAKE_MARGIN)
      .sort((a, b) => b.winRate! - a.winRate!)[0];
    if (best) best.take = true;
  }
  return rows.sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));
}
