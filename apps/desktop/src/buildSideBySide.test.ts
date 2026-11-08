import { describe, expect, it } from "vitest";
import type { Build, Variant } from "./api";
import { sideBySide, winRateBar } from "./buildSideBySide";

const picks = (core: number[]) => ({
  runes: [], spells: [], items: [], startItems: null, coreItems: { ids: core, games: 1, winRate: 0.5 }, skills: null,
});
const variant = (style: Variant["style"], games: number, winRate: number, core: number[]): Variant => ({ ...picks(core), style, games, winRate, share: 0.5 });
const build = (variants: Variant[], extra: Partial<Build> = {}): Build => ({
  ...picks([1, 2, 3]), patches: ["14.1"], games: 1000, winRate: 0.5, vs: null, variants, ...extra,
});

describe("side by side builds", () => {
  it("scales the win rate bar with the games and never goes under 20", () => {
    expect(winRateBar(100)).toBe(20);
    expect(winRateBar(10000)).toBe(300);
  });

  it("puts the most played build beside the best win rate that clears the bar", () => {
    const { columns } = sideBySide(build([variant("ap", 600, 0.5, [10]), variant("hybrid", 300, 0.56, [20]), variant("crit", 15, 0.9, [30])]));
    expect(columns.map((c) => [c.id, c.style])).toEqual([["popular", "ap"], ["winrate", "hybrid"]]);
  });

  it("does not repeat the build when the most played one also wins most", () => {
    const result = sideBySide(build([variant("ap", 600, 0.55, [10]), variant("hybrid", 300, 0.5, [20])]));
    expect(result.columns).toHaveLength(1);
    expect(result.sameAsPopular).toBe(true);
  });

  it("falls back to the build itself and adds the foe columns that exist", () => {
    const { columns } = sideBySide(
      build([], { situational: [{ vs: "tank", games: 400, items: [{ id: 3036, games: 100, winRate: 0.5 }] }, { vs: "ap", games: 0, items: [] }] }),
    );
    expect(columns.map((c) => c.id)).toEqual(["popular", "tank"]);
    expect(columns[0]).toMatchObject({ games: 1000, items: [1, 2, 3] });
    expect(columns[1]).toMatchObject({ games: 400, winRate: null, items: [3036] });
  });
});
