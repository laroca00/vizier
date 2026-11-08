import { describe, expect, it } from "vitest";
import { diffBuilds, diffList } from "./buildDiff";
import type { SavedBuild } from "./store";

const base = {
  id: "a", name: "A", championId: 1, position: null, runes: { primaryStyle: 8100, subStyle: 8300, perks: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  spells: [4, 14], startItems: [1056], coreItems: [1, 2, 3], items: [4, 5], skillOrder: [1, 2, 3], notes: "", collections: [], favourite: false, source: "custom", createdAt: 0, updatedAt: 0,
} as SavedBuild;
const other = (patch: Partial<SavedBuild>): SavedBuild => ({ ...base, id: "b", ...patch });

describe("build diff", () => {
  it("lists what one side has that the other lacks", () => {
    expect(diffList([1, 2, 3], [1, 3, 4])).toEqual({ same: false, onlyA: [2], onlyB: [4], reordered: false });
  });

  it("tells a reorder from a change", () => {
    expect(diffList([1, 2, 3], [3, 1, 2])).toMatchObject({ same: false, reordered: true });
    expect(diffList([1, 2], [1, 2])).toMatchObject({ same: true, reordered: false });
  });

  it("counts a repeated item once per copy", () => {
    expect(diffList([1, 1, 2], [1, 2]).onlyA).toEqual([1]);
  });

  it("calls the same build identical, even with spells swapped", () => {
    expect(diffBuilds(base, other({ spells: [14, 4] })).identical).toBe(true);
  });

  it("finds rune, item and skill differences", () => {
    const diff = diffBuilds(base, other({ runes: { primaryStyle: 8000, subStyle: 8300, perks: [1, 2, 3, 4, 5, 6, 7, 8, 10] }, coreItems: [3, 2, 1], items: [4, 6], skillOrder: [2, 1, 3] }));
    expect(diff.identical).toBe(false);
    expect(diff.runes).toEqual({ primaryStyle: true, subStyle: false, onlyA: [9], onlyB: [10] });
    expect(diff.coreItems.reordered).toBe(true);
    expect(diff.items).toMatchObject({ onlyA: [5], onlyB: [6] });
    expect(diff.skillOrder.same).toBe(false);
  });
});
