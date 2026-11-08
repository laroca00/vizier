import type { EntityDiff } from "./diff";
import type { PatchDiff } from "./load";

export type HistoryStep = { from: string; to: string; entry: EntityDiff };

/**
 * A champion's changes patch by patch, newest first, from whichever version
 * pairs have a diff. Versions come newest first; each step compares a version
 * with the one before it. Also says how many pairs had no diff to read.
 */
export function championHistory(versions: string[], diffOf: (from: string, to: string) => PatchDiff | null, championKey: string): { steps: HistoryStep[]; missing: number } {
  const steps: HistoryStep[] = [];
  let missing = 0;
  for (let i = 0; i + 1 < versions.length; i++) {
    const to = versions[i];
    const from = versions[i + 1];
    const diff = diffOf(from, to);
    if (!diff) {
      missing++;
      continue;
    }
    const entry = diff.entries.find((e) => e.kind === "champion" && e.id === championKey && (e.changes.length > 0 || e.status !== "changed"));
    if (entry) steps.push({ from, to, entry });
  }
  return { steps, missing };
}

/** Version pairs without a diff yet, newest first, for loading on request. */
export function missingPairs(versions: string[], diffOf: (from: string, to: string) => PatchDiff | null): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < versions.length; i++) if (!diffOf(versions[i + 1], versions[i])) pairs.push([versions[i + 1], versions[i]]);
  return pairs;
}
