import { describe, expect, it } from "vitest";
import type { RuneStyle } from "./data/ddragon";
import { splitPage, treeRows } from "./runeView";

const rune = (id: number) => ({ id, name: `r${id}`, icon: "" });
const STYLE: RuneStyle = { ...rune(8100), slots: [[rune(1), rune(2)], [rune(3), rune(4), rune(5)], [rune(6)]] };

describe("treeRows", () => {
  it("lights the chosen runes and gives the others a rate", () => {
    const rows = treeRows(STYLE, new Set([1, 4]), [{ id: 1, games: 70 }, { id: 2, games: 30 }, { id: 4, games: 50 }], 100);
    expect(rows[0].map((c) => [c.rune.id, c.chosen, c.rate])).toEqual([[1, true, 0.7], [2, false, 0.3]]);
    expect(rows[1].map((c) => [c.rune.id, c.chosen, c.games])).toEqual([[3, false, 0], [4, true, 50], [5, false, 0]]);
  });
  it("has no rates without perk counts or with too few games", () => {
    expect(treeRows(STYLE, new Set(), undefined, 100)[0][0]).toMatchObject({ games: null, rate: null });
    expect(treeRows(STYLE, new Set(), [{ id: 1, games: 3 }], 5)[0][0]).toMatchObject({ games: 3, rate: null });
  });
  it("can leave out the keystone row for the secondary tree", () => {
    expect(treeRows(STYLE, new Set(), [], 100, true)).toHaveLength(2);
  });
});

describe("splitPage", () => {
  it("splits primary, secondary and shards", () => {
    expect(splitPage([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ primary: [1, 2, 3, 4], secondary: [5, 6], shards: [7, 8, 9] });
  });
});
