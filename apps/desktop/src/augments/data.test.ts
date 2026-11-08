import { describe, expect, it } from "vitest";
import { pickOrder } from "./data";

describe("pickOrder", () => {
  const list = [
    { id: 1, tier: "B", winRate: 0.6 },
    { id: 2, tier: "S", winRate: 0.52 },
    { id: 3, tier: "S", winRate: 0.55 },
    { id: 4, tier: "?", winRate: 0.9 },
  ];

  it("puts the best tier first and breaks ties by win rate", () => {
    expect(pickOrder(list, 4).map((a) => a.id)).toEqual([3, 2, 1, 4]);
  });

  it("limits the count and leaves the input alone", () => {
    expect(pickOrder(list, 2).map((a) => a.id)).toEqual([3, 2]);
    expect(list[0].id).toBe(1);
  });
});
