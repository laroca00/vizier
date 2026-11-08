import { describe, expect, it } from "vitest";
import { tierOf, tierScore } from "./stats.ts";

describe("tierScore", () => {
  it("keeps a lucky small sample out of S", () => {
    // 30 games at 80% against 4000 games at 53%.
    expect(tierOf(tierScore(24, 30, 0.5, 0))).not.toBe("S");
    expect(tierOf(tierScore(2120, 4000, 0.5, 0))).toBe("S");
  });
  it("shrinks towards the role's average, not a fixed 50%", () => {
    // The same record is worth the same score whatever the role average is.
    expect(tierScore(520, 1000, 0.5, 0)).toBe(tierScore(540, 1000, 0.52, 0));
  });
  it("lets presence move a score by a small step", () => {
    expect(tierScore(520, 1000, 0.5, 2)).toBeGreaterThan(tierScore(520, 1000, 0.5, 0));
    expect(tierScore(520, 1000, 0.5, -3)).toBeLessThan(tierScore(520, 1000, 0.5, 0));
  });
});
