import type { TierEntry } from "../api";
import { verdict, type Change, type Verdict } from "../patches/diff";
import type { PatchDiff } from "../patches/load";
import { poolMoves } from "../poolMoves";

export type PatchRow = {
  championId: number;
  position: string;
  tier: string;
  winRate: number;
  winRateChange: number | null;
  games: number;
  /** Null when the patch didn't touch the champion or the diff isn't cached yet. */
  verdict: Verdict | null;
  changes: Change[];
};

/**
 * One row per pool pick: where it stands this patch and what the patch did to
 * it. Champions the patch changed come first, then the biggest win rate moves.
 */
export function thisPatchRows(pool: { championId: number; position: string | null }[], lists: Record<string, TierEntry[]>, diff: PatchDiff | null): PatchRow[] {
  const touched = new Map((diff?.entries ?? []).filter((e) => e.kind === "champion").map((e) => [e.id, e]));
  return poolMoves(pool, lists)
    .map((m) => {
      const entry = lists[m.position]?.find((e) => e.championId === m.championId);
      const change = touched.get(String(m.championId));
      return { ...m, tier: entry?.tier ?? "", verdict: change ? verdict(change) : null, changes: change?.changes ?? [] };
    })
    .sort((a, b) => Number(b.changes.length > 0) - Number(a.changes.length > 0) || Math.abs(b.winRateChange ?? 0) - Math.abs(a.winRateChange ?? 0));
}
