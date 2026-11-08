import { describe, expect, it } from "vitest";
import { comparisonRows } from "./comparison";

describe("comparisonRows", () => {
  const entries = [
    { id: 1, games: 30, winRate: 0.5 },
    { id: 2, games: 60, winRate: 0.55 },
    { id: 3, games: 2, winRate: 1 },
  ];
  it("orders by games and gives each a pick rate out of the total", () => {
    const rows = comparisonRows(entries, 100, 5);
    expect(rows.map((r) => [r.entry.id, r.pickRate])).toEqual([[2, 0.6], [1, 0.3]]);
  });
  it("drops rows with too few games and respects the limit", () => {
    expect(comparisonRows(entries, 100, 1)).toHaveLength(1);
  });
  it("is empty without games", () => {
    expect(comparisonRows(entries, 0, 5)).toEqual([]);
  });
});
