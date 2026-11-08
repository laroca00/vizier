import { describe, expect, it } from "vitest";
import { metaRows } from "./proMeta";

const entries = [
  { championId: 1, position: "MIDDLE", games: 6, wins: 3 },
  { championId: 2, position: "MIDDLE", games: 2, wins: 2 },
  { championId: 1, position: "TOP", games: 2, wins: 0 },
  { championId: 3, position: "TOP", games: 2, wins: 1 },
];

describe("metaRows", () => {
  it("lists one role by games with the share of that role's games", () => {
    const rows = metaRows(entries, "MIDDLE");
    expect(rows.map((r) => r.championId)).toEqual([1, 2]);
    expect(rows[0].share).toBeCloseTo(0.75);
  });

  it("merges roles when none is picked", () => {
    const rows = metaRows(entries, null);
    expect(rows[0]).toMatchObject({ championId: 1, games: 8, wins: 3 });
    expect(rows[0].share).toBeCloseTo(8 / 12);
  });

  it("is empty without games", () => {
    expect(metaRows([], null)).toEqual([]);
  });
});
