import { describe, expect, it } from "vitest";
import type { Build } from "../api";
import { mainsDiffer } from "./mainsBuild";

const choice = <T,>(v: T) => ({ ...v, games: 100, winRate: 0.5 });
const picks = (core: number[], items: number[], keystone = 8112) => ({
  runes: [choice({ primaryStyle: 8100, subStyle: 8300, perks: [keystone] })],
  spells: [],
  items: items.map((id) => choice({ id })),
  startItems: null,
  coreItems: choice({ ids: core }),
  skills: null,
});
const mains = (p: ReturnType<typeof picks>) => ({ games: 80, winRate: 0.55, ...p }) as NonNullable<Build["mains"]>;

describe("mainsDiffer", () => {
  it("is false for the same build", () => {
    expect(mainsDiffer(picks([1, 2, 3], [1, 2, 3, 4, 5]), mains(picks([1, 2, 3], [1, 2, 3, 4, 5])))).toBe(false);
  });
  it("is true for other core items, another keystone or two new top items", () => {
    const popular = picks([1, 2, 3], [1, 2, 3, 4, 5]);
    expect(mainsDiffer(popular, mains(picks([1, 2, 9], [1, 2, 3, 4, 5])))).toBe(true);
    expect(mainsDiffer(popular, mains(picks([1, 2, 3], [1, 2, 3, 4, 5], 8010)))).toBe(true);
    expect(mainsDiffer(popular, mains(picks([], [1, 2, 3, 8, 9])))).toBe(true);
  });
  it("ignores one swapped item", () => {
    expect(mainsDiffer(picks([], [1, 2, 3, 4, 5]), mains(picks([], [1, 2, 3, 4, 9])))).toBe(false);
  });
});
