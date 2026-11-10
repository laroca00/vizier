import { describe, expect, it } from "vitest";
import { strongObjectives } from "./objectives";

const rate = (key: string, rate: number, roleRate: number) => ({ key, games: Math.round(rate * 1000), rate, winRate: 0.5, roleRate });

describe("strongObjectives", () => {
  it("keeps objectives whose interval clears the role rate", () => {
    expect(strongObjectives([rate("d", 0.6, 0.5), rate("t", 0.52, 0.5), rate("c", 0.4, 0.5)], 1000)).toEqual(["d"]);
  });
  it("says nothing on a thin sample", () => {
    expect(strongObjectives([rate("d", 0.6, 0.5)], 40)).toEqual([]);
  });
});
