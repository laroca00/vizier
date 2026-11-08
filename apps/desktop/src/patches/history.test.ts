import { describe, expect, it } from "vitest";
import type { EntityDiff } from "./diff";
import { championHistory, missingPairs } from "./history";
import type { PatchDiff } from "./load";

const entry = (id: string, field: string): EntityDiff => ({ kind: "champion", id, name: `#${id}`, status: "changed", changes: [{ field, before: 1, after: 2 }] });
const diff = (from: string, to: string, entries: EntityDiff[]): PatchDiff => ({ from, to, entries, itemNames: {} });

const versions = ["16.22.1", "16.21.1", "16.20.1", "16.19.1"];
const diffs: Record<string, PatchDiff> = {
  "16.21.1>16.22.1": diff("16.21.1", "16.22.1", [entry("103", "stat:hp"), entry("7", "stat:armor")]),
  // 16.20 → 16.21 was never opened in the tracker.
  "16.19.1>16.20.1": diff("16.19.1", "16.20.1", [entry("103", "spell:0:cooldown")]),
};
const diffOf = (from: string, to: string) => diffs[`${from}>${to}`] ?? null;

describe("championHistory", () => {
  it("lists the champion's changes newest first and counts unread pairs", () => {
    const { steps, missing } = championHistory(versions, diffOf, "103");
    expect(steps.map((s) => s.to)).toEqual(["16.22.1", "16.20.1"]);
    expect(steps[1].entry.changes[0].field).toBe("spell:0:cooldown");
    expect(missing).toBe(1);
  });

  it("returns nothing for an untouched champion", () => {
    expect(championHistory(versions, diffOf, "222").steps).toEqual([]);
  });
});

describe("missingPairs", () => {
  it("names the pairs without a diff", () => expect(missingPairs(versions, diffOf)).toEqual([["16.20.1", "16.21.1"]]));
});
