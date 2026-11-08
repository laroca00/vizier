import { toClient, type ExportLabels } from "./library/convert";
import type { BuildDraft, SavedBuild } from "./library/store";
import type { PoolPick } from "./personal";

// Writes an item set for every pool champion into the client. A pick uses
// the saved build chosen for it; without one, the recommended build.

export type ExportPlan = {
  pick: PoolPick;
  /** The saved build to use, or null to fetch the recommended build. */
  saved: SavedBuild | null;
};

/** One entry per champion and role; a chosen build that was deleted falls back to the recommended one. */
export function planPoolExport(pool: PoolPick[], builds: SavedBuild[]): ExportPlan[] {
  const seen = new Set<string>();
  const plans: ExportPlan[] = [];
  for (const pick of pool) {
    const key = `${pick.championId}:${pick.position}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const saved = pick.buildId ? (builds.find((b) => b.id === pick.buildId && b.championId === pick.championId) ?? null) : null;
    plans.push({ pick, saved });
  }
  return plans;
}

export type ItemSetPayload = { championId: number; title: string; blocks: { title: string; items: number[] }[] };

/** The client accepts an item set only with at least one block of items. */
export function itemSetOf(build: BuildDraft, labels: ExportLabels): ItemSetPayload | null {
  const set = toClient(build, labels).itemSet;
  return set.blocks.length ? set : null;
}

export type ExportSummary = { written: number; skipped: number; failed: number };

export function summarize(results: ("written" | "skipped" | "failed")[]): ExportSummary {
  return {
    written: results.filter((r) => r === "written").length,
    skipped: results.filter((r) => r === "skipped").length,
    failed: results.filter((r) => r === "failed").length,
  };
}
