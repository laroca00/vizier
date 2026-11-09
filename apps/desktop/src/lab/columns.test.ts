import { describe, expect, it } from "vitest";
import type { Build, Picks, Variant } from "../api";
import type { SavedBuild } from "../library/store";
import { customColumn, customFrom, labColumns, proColumn, savedFor } from "./columns";

const picks = (core: number[]): Picks => ({
  runes: [{ primaryStyle: 8000, subStyle: 8100, perks: [8005], games: 10, winRate: 0.5 }],
  spells: [{ ids: [4, 14], games: 10, winRate: 0.5 }],
  items: core.map((id) => ({ id, games: 10, winRate: 0.5 })),
  startItems: { ids: [1055], games: 10, winRate: 0.5 },
  coreItems: { ids: core, games: 10, winRate: 0.5 },
  skills: null,
});
const variant = (style: Variant["style"], core: number[], games: number, winRate: number): Variant => ({ ...picks(core), style, games, winRate, share: 0 });
const build = (variants: Variant[]): Build => ({ ...picks([1]), patches: ["16.21"], games: 1000, winRate: 0.5, vs: null, variants }) as Build;
const saved = (over: Partial<SavedBuild>): SavedBuild => ({
  id: "s", name: "x", championId: 1, position: null, runes: { primaryStyle: 8000, subStyle: 8100, perks: [] }, spells: [4, 14],
  startItems: [], coreItems: [], items: [], skillOrder: [1, 2, 3], notes: "", collections: [], favourite: false, source: "custom", createdAt: 0, updatedAt: 0, ...over,
});
const ctx = { position: "MIDDLE", finished: () => true };

describe("labColumns", () => {
  it("starts with the most played variant and the best win rate among those with enough games", () => {
    const columns = labColumns(build([variant("ap", [10], 600, 0.5), variant("hybrid", [20], 300, 0.56), variant("ad", [30], 5, 0.9)]), null, 1, ctx);
    expect(columns.map((c) => [c.id, c.style])).toEqual([["popular", "ap"], ["winrate", "hybrid"]]);
    expect(columns[1].build.coreItems).toEqual([20]);
    expect(columns[1].sample).toEqual({ games: 300, winRate: 0.56 });
  });
  it("leaves out the win rate column when it would repeat the popular one", () => {
    const columns = labColumns(build([variant("ap", [10], 900, 0.55), variant("ad", [30], 100, 0.5)]), null, 1, ctx);
    expect(columns.map((c) => c.id)).toEqual(["popular"]);
  });
  it("falls back to the overall build without variants and adds the saved build without a sample", () => {
    const columns = labColumns(build([]), saved({ coreItems: [7] }), 1, ctx);
    expect(columns.map((c) => c.id)).toEqual(["popular", "saved"]);
    expect(columns[1].sample).toBeNull();
  });
  it("works with only a saved build when the API has nothing", () => {
    expect(labColumns(null, saved({}), 1, ctx).map((c) => c.id)).toEqual(["saved"]);
  });
});

describe("savedFor", () => {
  it("keeps the champion's builds for the role, favourites first then newest", () => {
    const list = [saved({ id: "a", updatedAt: 5 }), saved({ id: "b", updatedAt: 9 }), saved({ id: "c", favourite: true, updatedAt: 1 }), saved({ id: "d", championId: 2 }), saved({ id: "e", position: "TOP" })];
    expect(savedFor(list, 1, "MIDDLE").map((b) => b.id)).toEqual(["c", "b", "a"]);
  });
});

describe("custom and pro columns", () => {
  it("copies a column into an editable build that is not in the library yet", () => {
    const [popular] = labColumns(build([variant("ap", [10, 11], 600, 0.5)]), null, 1, ctx);
    const copy = customFrom(popular, "Özel", 5);
    expect(copy).toMatchObject({ id: "lab-custom", name: "Özel", source: "custom", coreItems: popular.build.coreItems, favourite: false });
    expect(customColumn(copy)).toMatchObject({ id: "custom", sample: null, basis: "own" });
  });
  it("turns a pro game into a column with who played it", () => {
    const pro = { player: "Chovy", team: "GEN", patch: "16.21", runes: "8000:8100:8005::", spells: [4, 14], items: [], startItems: [1055], skillOrder: [1, 2, 3], purchases: [3000, 3100, 1055] } as never;
    const column = proColumn(pro, 1, ctx);
    expect(column).toMatchObject({ id: "pro", basis: "pro", note: "Chovy · GEN · 16.21", sample: null });
    expect(column.build.coreItems).toEqual([3000, 3100, 1055]);
  });
});
