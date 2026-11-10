import { BRACKETS, type Bracket } from "@vizier/shared/brackets";
import type { CoverageDoc } from "../api";

export const PLATFORMS = ["TR1", "EUW1", "KR"] as const;

export type CoverageRow = {
  bracket: Bracket;
  /** Ranked games per platform; 0 where none were counted. */
  platforms: Record<(typeof PLATFORMS)[number], number>;
  games: number;
  /** Share of this bracket's ranked games with a timeline; null when unknown. */
  timelineShare: number | null;
};

/** One row per bracket for the newest patch with bracket data; empty until the all-rank crawl was published. */
export function coverageRows(doc: CoverageDoc | null): { patch: string; rows: CoverageRow[] } | null {
  const counted = doc?.brackets?.filter((b) => b.queue === 420) ?? [];
  if (!doc || counted.length === 0) return null;
  const patch = doc.patches.find((p) => counted.some((b) => b.patch === p)) ?? counted[0].patch;
  const rows = BRACKETS.map((bracket): CoverageRow => {
    const platforms = { TR1: 0, EUW1: 0, KR: 0 };
    for (const b of counted) {
      if (b.patch === patch && b.bracket === bracket && b.platform in platforms) platforms[b.platform as keyof typeof platforms] += b.games;
    }
    const timeline = doc.timelineBrackets?.find((r) => r.patch === patch && r.queue === 420 && r.bracket === bracket);
    return { bracket, platforms, games: platforms.TR1 + platforms.EUW1 + platforms.KR, timelineShare: timeline?.share ?? null };
  });
  return { patch, rows };
}

/** Games left out of the stats in a patch because of a remake or a player who left, with how much of the crawled games they were. */
export function droppedGames(doc: CoverageDoc | null, patch: string): { surrender: number; afk: number; share: number | null } | null {
  const rows = doc?.dropped?.filter((r) => r.patch === patch && r.queue === 420) ?? [];
  if (rows.length === 0) return null;
  const count = (reason: string) => rows.filter((r) => r.reason === reason).reduce((sum, r) => sum + r.games, 0);
  const kept = doc?.games.filter((g) => g.patch === patch && g.queue === 420).reduce((sum, g) => sum + g.games, 0) ?? 0;
  const surrender = count("surrender");
  const afk = count("afk");
  const all = kept + surrender + afk;
  return { surrender, afk, share: all > 0 ? (surrender + afk) / all : null };
}

/** Games of the patch whose roles had to be inferred, or 0. */
export function roleFixedGames(doc: CoverageDoc | null, patch: string): number {
  return doc?.roleFixed?.filter((r) => r.patch === patch && r.queue === 420).reduce((sum, r) => sum + r.games, 0) ?? 0;
}
