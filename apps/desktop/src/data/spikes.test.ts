import { describe, expect, it } from "vitest";
import { spikesFor } from "./spikes";

describe("spikesFor", () => {
  it("takes levels 2 and 3 from the skill order and the ultimate ranks from 6, 11 and 16", () => {
    expect(spikesFor([1, 2, 3])).toEqual([
      { level: 2, slot: "W", rank: 1 },
      { level: 3, slot: "E", rank: 1 },
      { level: 6, slot: "R", rank: 1 },
      { level: 11, slot: "R", rank: 2 },
      { level: 16, slot: "R", rank: 3 },
    ]);
  });
  it("falls back to the ultimate when the skill order is unknown", () => {
    expect(spikesFor(null).map((s) => s.level)).toEqual([6, 11, 16]);
    expect(spikesFor([]).map((s) => s.level)).toEqual([6, 11, 16]);
  });
  it("ignores an ultimate taken before level 6", () => {
    expect(spikesFor([1, 4, 2]).map((s) => s.level)).toEqual([3, 6, 11, 16]);
  });
});
