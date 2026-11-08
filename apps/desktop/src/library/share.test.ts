import { describe, expect, it } from "vitest";
import { findShareCode, readShareCode, shareCode } from "./share";
import type { SavedBuild } from "./store";

const build: SavedBuild = {
  id: "a", name: "Ahri ğüşıöç burst", championId: 103, position: "MIDDLE",
  runes: { primaryStyle: 8100, subStyle: 8300, perks: [8112, 8143, 8138, 8135, 8304, 8347, 5008, 5008, 5011] },
  spells: [4, 14], startItems: [1056, 2003], coreItems: [6655, 3020, 3089], items: [3157, 3135, 3165],
  skillOrder: [1, 3, 2], notes: "", collections: [], favourite: false, source: "custom", createdAt: 0, updatedAt: 0,
};

// The JSON code older versions wrote.
const v1 = (b: SavedBuild) =>
  "VZB1:" + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ n: b.name, c: b.championId, p: b.position, r: [b.runes.primaryStyle, b.runes.subStyle, b.runes.perks], s: b.spells, i: [b.startItems, b.coreItems, b.items], k: b.skillOrder })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("share codes v2", () => {
  it("round-trips every shared field", () => {
    const back = readShareCode(shareCode(build))!;
    expect(back).toMatchObject({ name: build.name, championId: 103, position: "MIDDLE", runes: build.runes, spells: [4, 14], startItems: build.startItems, coreItems: build.coreItems, items: build.items, skillOrder: [1, 3, 2] });
  });

  it("is much shorter than the old code", () => {
    expect(shareCode(build).length).toBeLessThan(v1(build).length * 0.6);
  });

  it("still reads old codes", () => {
    expect(readShareCode(v1(build))?.coreItems).toEqual(build.coreItems);
  });

  it("keeps a missing role as any role", () => {
    expect(readShareCode(shareCode({ ...build, position: null }))?.position).toBeNull();
  });

  it("rejects truncated, padded and damaged codes", () => {
    const code = shareCode(build);
    expect(readShareCode(code.slice(0, -6))).toBeNull();
    expect(readShareCode(code + "AAAA")).toBeNull();
    expect(readShareCode("VZ2:")).toBeNull();
    expect(readShareCode("VZ2:@@@@")).toBeNull();
  });

  it("finds a code inside a pasted message", () => {
    const code = shareCode(build);
    expect(findShareCode(`try this one: ${code}\nthanks!`)).toBe(code);
    expect(findShareCode("no code here")).toBeNull();
  });
});
