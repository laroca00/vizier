import { describe, expect, it } from "vitest";
import { rankNotes } from "./rankReason";

const list = (...ids: number[]) => ids.map((championId) => ({ championId }));

describe("rankNotes", () => {
  it("notes picks that climb two places or more, or are missing from Emerald+", () => {
    const notes = rankNotes(list(5, 1, 2, 9), list(1, 2, 3, 5));
    expect(notes.get(5)).toEqual({ place: 1, baseline: 4 });
    expect(notes.get(9)).toEqual({ place: 4, baseline: null });
    expect(notes.has(1)).toBe(false);
    expect(notes.has(2)).toBe(false);
  });
  it("gives nothing when the order is the same", () => {
    expect(rankNotes(list(1, 2, 3), list(1, 2, 3)).size).toBe(0);
  });
  it("ignores a single place of difference and a pick that fell", () => {
    expect(rankNotes(list(2, 1), list(1, 2)).size).toBe(0);
    expect(rankNotes(list(3, 1, 2), list(1, 2, 3)).get(3)).toEqual({ place: 1, baseline: 3 });
  });
});
