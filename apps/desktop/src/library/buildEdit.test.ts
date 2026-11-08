import { describe, expect, it } from "vitest";
import type { RuneStyle } from "../data/ddragon";
import { duplicateItems, moveItem, runeIssues } from "./buildEdit";

const rune = (id: number) => ({ id, name: String(id), icon: "" });
const style = (id: number, base: number): RuneStyle => ({ ...rune(id), slots: [0, 1, 2, 3].map((row) => [rune(base + row * 10), rune(base + row * 10 + 1)]) });
const styles = new Map([[8000, style(8000, 100)], [8100, style(8100, 200)]]);
const page = { primaryStyle: 8000, subStyle: 8100, perks: [100, 110, 120, 130, 211, 221, 5008, 5010, 5011] };

describe("build editing", () => {
  it("moves an item and ignores impossible moves", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    const same = [1, 2];
    expect(moveItem(same, 0, 5)).toBe(same);
    expect(moveItem(same, 1, 1)).toBe(same);
  });

  it("finds items repeated across core and situational lists only", () => {
    expect(duplicateItems({ coreItems: [1, 2], items: [2, 3, 3] }).sort()).toEqual([2, 3]);
    expect(duplicateItems({ coreItems: [1, 2], items: [3] })).toEqual([]);
  });

  it("accepts a complete rune page", () => {
    expect(runeIssues(page, styles)).toEqual([]);
  });

  it("names what is wrong with a page", () => {
    expect(runeIssues({ ...page, subStyle: 8000 }, styles)).toContain("same-tree");
    expect(runeIssues({ ...page, perks: [100, 0, 0, 0, 211, 221, 5008, 5010, 5011] }, styles)).toContain("primary");
    expect(runeIssues({ ...page, perks: [100, 110, 120, 130, 211, 0, 5008, 5010, 5011] }, styles)).toContain("secondary");
    expect(runeIssues({ ...page, perks: [100, 110, 120, 130, 211, 210, 5008, 5010, 5011] }, styles)).toContain("secondary-rows");
    expect(runeIssues({ ...page, perks: [100, 110, 120, 130, 211, 221, 5008, 0, 0] }, styles)).toContain("shards");
    expect(runeIssues({ ...page, perks: [200, 110, 120, 130, 211, 221, 5008, 5010, 5011] }, styles)).toContain("wrong-tree");
    expect(runeIssues({ ...page, perks: [100, 110, 120, 130, 101, 221, 5008, 5010, 5011] }, styles)).toContain("wrong-tree");
  });
});
