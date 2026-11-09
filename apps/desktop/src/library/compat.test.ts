import { describe, expect, it } from "vitest";
import type { Item, ItemDetail, RuneStyle } from "../data/ddragon";
import { checkBuild, type CompatData } from "./compat";
import type { SavedBuild } from "./store";

const item = (id: number, boots = false): Item => ({ id, name: `Item${id}`, complete: true, gold: 1000, boots });
const detail = (id: number, from: number[] = [], purchasable = true): ItemDetail =>
  ({ id, name: `Item${id}`, plaintext: "", gold: { base: 100, total: 1000, purchasable }, from, into: [], stats: {}, tags: [], complete: true }) as ItemDetail;

const rune = (id: number) => ({ id, name: `R${id}`, icon: "" });
const style = (id: number): RuneStyle => ({ ...rune(id), slots: [[rune(id * 10 + 1)], [rune(id * 10 + 2)], [rune(id * 10 + 3)], [rune(id * 10 + 4)]] });
const styles = new Map([[8100, style(8100)], [8300, style(8300)]].map(([id, s]) => [id as number, { ...(s as RuneStyle), slots: (s as RuneStyle).slots.map((row, i) => row.map((r) => ({ ...r, id: (id as number) + i * 10 + 1 }))) }]));

const data: CompatData = {
  items: new Map([item(1), item(2), item(3, true), item(4, true), item(5)].map((i) => [i.id, i])),
  details: new Map([detail(1, [5]), detail(2), detail(3), detail(4), detail(5)].map((d) => [d.id, d])),
  styles,
  rolesOf: (id) => (id === 103 ? ["MIDDLE"] : []),
};

const base: SavedBuild = {
  id: "b", name: "Test", championId: 103, position: "MIDDLE",
  runes: { primaryStyle: 8100, subStyle: 8300, perks: [8101, 8111, 8121, 8131, 8311, 8321, 5008, 5008, 5011] },
  spells: [4, 14], startItems: [2], coreItems: [1, 2], items: [3], skillOrder: [1, 2, 3], notes: "", collections: [], favourite: false, source: "custom", createdAt: 0, updatedAt: 0,
};

const kinds = (b: SavedBuild, d = data) => checkBuild(b, d).map((i) => i.kind);

describe("checkBuild", () => {
  it("passes a clean build except what it shows", () => {
    // Item 2 sits in start and core (a start item may repeat), item 5 is a part of item 1 but not listed.
    expect(kinds(base)).toEqual([]);
  });

  it("flags removed items and offers to drop them", () => {
    const issues = checkBuild({ ...base, items: [3, 99] }, data);
    const removed = issues.find((i) => i.kind === "removed-item")!;
    expect(removed.ids).toEqual([99]);
    expect(removed.fix!.apply({ ...base, items: [3, 99] }).items).toEqual([3]);
  });

  it("flags items that can no longer be bought", () => {
    const d = { ...data, details: new Map(data.details).set(2, detail(2, [], false)) };
    expect(kinds(base, d)).toContain("unavailable-item");
  });

  it("flags unknown runes and a broken rune page", () => {
    expect(kinds({ ...base, runes: { ...base.runes, perks: [9999, ...base.runes.perks.slice(1)] } })).toContain("unknown-rune");
    expect(kinds({ ...base, runes: { ...base.runes, subStyle: 8100 } })).toContain("rune-page");
  });

  it("flags spells that are not on the Rift", () => {
    expect(kinds({ ...base, spells: [4, 999] })).toContain("unknown-spell");
  });

  it("flags repeated items and removes the repeats on request", () => {
    const b = { ...base, coreItems: [1, 2], items: [1] };
    const issue = checkBuild(b, data).find((i) => i.kind === "duplicate-item")!;
    expect(issue.fix!.apply(b).items).toEqual([]);
  });

  it("flags more than one pair of boots", () => {
    expect(kinds({ ...base, coreItems: [1, 3], items: [4] })).toContain("several-boots");
  });

  it("flags a component listed after the item it builds into", () => {
    const b = { ...base, coreItems: [1], items: [5] };
    const issue = checkBuild(b, data).find((i) => i.kind === "component-after-item")!;
    expect(issue.ids).toEqual([5]);
    expect(issue.fix!.apply(b).items).toEqual([]);
    expect(kinds({ ...base, coreItems: [5], items: [1] })).not.toContain("component-after-item");
  });

  it("flags a role the champion is rarely played in, and stays quiet without role data", () => {
    expect(kinds({ ...base, position: "TOP" })).toContain("role-mismatch");
    expect(kinds({ ...base, position: "TOP" }, { ...data, rolesOf: null })).not.toContain("role-mismatch");
    expect(kinds({ ...base, championId: 1, position: "TOP" })).not.toContain("role-mismatch");
  });

  it("never changes the build by itself", () => {
    const b = { ...base, items: [3, 99] };
    const copy = JSON.stringify(b);
    checkBuild(b, data);
    expect(JSON.stringify(b)).toBe(copy);
  });
});
