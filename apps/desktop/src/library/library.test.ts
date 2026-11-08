import { describe, expect, it } from "vitest";
import type { Picks, ProBuild } from "../api";
import { fromPicks, fromPro, maxOrderOf, parseRuneKey, runesComplete, toClient } from "./convert";
import { buildGold } from "./gold";
import { readShareCode, shareCode } from "./share";
import { parseLibrary, type SavedBuild } from "./store";

const finished = (id: number) => id >= 3000;

const picks: Picks = {
  runes: [{ primaryStyle: 8100, subStyle: 8300, perks: [8112, 8143, 8138, 8135, 8304, 8347, 5008, 5008, 5011], games: 10, winRate: 0.5 }],
  spells: [{ ids: [4, 14], games: 10, winRate: 0.5 }],
  items: [{ id: 3020, games: 9, winRate: 0.5 }, { id: 6655, games: 8, winRate: 0.5 }, { id: 1056, games: 8, winRate: 0.5 }, { id: 3089, games: 7, winRate: 0.5 }],
  startItems: { ids: [1056, 2003], games: 10, winRate: 0.5 },
  coreItems: { ids: [6655, 3020], games: 10, winRate: 0.5 },
  skills: { maxOrder: [1, 3, 2], firstLevels: [1, 2, 3], games: 10, winRate: 0.5 },
};

describe("saved builds", () => {
  it("copies a recommended build, keeping only finished items after the core", () => {
    const draft = fromPicks({ name: "Ahri", championId: 103, position: "MIDDLE" }, picks, finished);
    expect(draft.coreItems).toEqual([6655, 3020]);
    expect(draft.items).toEqual([3089]);
    expect(draft.startItems).toEqual([1056, 2003]);
    expect(draft.skillOrder).toEqual([1, 3, 2]);
    expect(runesComplete(draft.runes)).toBe(true);
  });

  it("copies a pro game in buy order", () => {
    const pro = {
      runes: "8100:8300:8112,8143,8138,8135:8304,8347:5008,5008,5011",
      spells: [14, 4],
      startItems: [1056],
      purchases: [1056, 3020, 2003, 6655, 3089, 3020, 3135],
      skillOrder: [1, 2, 3, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2, 4, 2, 2],
    } as ProBuild;
    const draft = fromPro({ name: "Faker Ahri", championId: 103, position: "MIDDLE" }, pro, finished);
    expect(draft.coreItems).toEqual([3020, 6655, 3089]);
    expect(draft.items).toEqual([3135]);
    expect(draft.spells).toEqual([14, 4]);
    expect(draft.skillOrder).toEqual([1, 3, 2]);
    expect(draft.runes.perks).toHaveLength(9);
  });

  it("reads the max order from level-ups", () => {
    expect(maxOrderOf([1, 2, 3, 1, 1, 4, 1, 1])).toEqual([1, 2, 3]);
    expect(maxOrderOf([])).toEqual([1, 2, 3]);
  });

  it("parses a rune key without shards", () => {
    expect(parseRuneKey("8100:8300:1,2,3,4:5,6:")).toEqual({ primaryStyle: 8100, subStyle: 8300, perks: [1, 2, 3, 4, 5, 6] });
  });

  it("maps a saved build to the client's rune page and item set", () => {
    const build: SavedBuild = {
      ...fromPicks({ name: "Ahri burst", championId: 103, position: "MIDDLE" }, picks, finished),
      id: "a",
      createdAt: 0,
      updatedAt: 0,
    };
    const client = toClient(build, { start: "Start", core: "Core", more: "More" });
    expect(client.page).toEqual({ name: "Ahri burst", primaryStyleId: 8100, subStyleId: 8300, selectedPerkIds: picks.runes[0].perks });
    expect(client.itemSet.blocks.map((b) => b.title)).toEqual(["Start", "Core", "More"]);
    expect(client.itemSet.championId).toBe(103);
  });

  it("survives a damaged library", () => {
    expect(parseLibrary("not json").builds).toEqual([]);
    const library = parseLibrary(JSON.stringify({ builds: [{ id: "x" }, { id: "y", championId: 1, runes: { perks: [] }, items: "bad" }], collections: ["Ana"] }));
    expect(library.builds.map((b) => b.id)).toEqual(["y"]);
    expect(library.builds[0].items).toEqual([]);
    expect(library.collections).toEqual(["Ana"]);
  });

  it("round-trips a build through a share code, keeping notes private", () => {
    const build: SavedBuild = {
      ...fromPicks({ name: "Ahri ğüşıöç burst", championId: 103, position: "MIDDLE" }, picks, finished),
      notes: "private",
      collections: ["Ana"],
      id: "a",
      createdAt: 0,
      updatedAt: 0,
    };
    const code = shareCode(build);
    expect(code.startsWith("VZ2:")).toBe(true);
    const back = readShareCode(`  ${code}\n`)!;
    expect(back.name).toBe("Ahri ğüşıöç burst");
    expect(back.runes).toEqual(build.runes);
    expect(back.coreItems).toEqual(build.coreItems);
    expect(back.notes).toBe("");
    expect(back.collections).toEqual([]);
  });

  it("rejects codes that aren't Vizier builds", () => {
    expect(readShareCode("hello")).toBeNull();
    expect(readShareCode("VZB1:not-base64!!")).toBeNull();
    expect(readShareCode("VZB1:" + btoa(JSON.stringify({ n: "x", c: 1 })))).toBeNull();
  });

  it("adds up a build's gold and its two-item spike", () => {
    const price = (id: number) => ({ 1056: 400, 3020: 1100, 6655: 2900, 3089: 3600 })[id] ?? 0;
    expect(buildGold({ startItems: [1056], coreItems: [6655, 3020, 3089], items: [3089] }, price)).toEqual({
      start: 400,
      core: 7600,
      rest: 3600,
      total: 11600,
      spike: { items: 2, gold: 4400 },
    });
    expect(buildGold({ startItems: [], coreItems: [], items: [] }, price).spike).toBeNull();
  });
});
