import { describe, expect, it } from "vitest";
import type { RuneStyle } from "../data/ddragon";
import { panelItems, panelRunes } from "./buildPanel";

describe("panelItems", () => {
  const finished = (id: number) => id < 1000;
  it("lists core items first, drops components and repeats, and ticks what is owned", () => {
    const items = panelItems([10, 20, 30], [20, 1500, 40], [20, 40], finished);
    expect(items).toEqual([
      { id: 10, owned: false },
      { id: 20, owned: true },
      { id: 30, owned: false },
      { id: 40, owned: true },
    ]);
  });
  it("stops at six", () => {
    expect(panelItems([1, 2, 3, 4, 5, 6, 7, 8], [], [], finished)).toHaveLength(6);
  });
});

describe("panelRunes", () => {
  const style = (id: number, ids: number[]): RuneStyle => ({ id, name: `s${id}`, icon: "", slots: ids.map((r) => [{ id: r, name: `r${r}`, icon: `i${r}` }]) });
  const styles = new Map([[1, style(1, [11, 12, 13, 14])], [2, style(2, [21, 22])]]);
  it("splits a page into keystone, primary and secondary", () => {
    const result = panelRunes({ primaryStyle: 1, subStyle: 2, perks: [11, 12, 13, 14, 21, 22] }, styles)!;
    expect(result.keystone?.id).toBe(11);
    expect(result.primary.map((r) => r.name)).toEqual(["r12", "r13", "r14"]);
    expect(result.secondary.map((r) => r.name)).toEqual(["r21", "r22"]);
  });
  it("is null without data", () => {
    expect(panelRunes(undefined, styles)).toBeNull();
    expect(panelRunes({ primaryStyle: 1, subStyle: 2, perks: [] }, null)).toBeNull();
  });
});
