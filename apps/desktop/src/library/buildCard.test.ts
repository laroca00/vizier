import { describe, expect, it } from "vitest";
import { cardContent } from "./buildCard";
import type { LibraryData } from "./data";
import type { SavedBuild } from "./store";

const data = {
  version: "16.22.1",
  champions: new Map([[103, { id: "Ahri", key: 103, name: "Ahri", magic: true }]]),
  items: new Map([
    [1056, { id: 1056, name: "Doran's Ring", complete: false, gold: 400 }],
    [6655, { id: 6655, name: "Luden's Companion", complete: true, gold: 2850 }],
    [3089, { id: 3089, name: "Rabadon's Deathcap", complete: true, gold: 3600 }],
  ]),
  details: new Map(),
  styles: new Map(),
  runes: new Map([
    [8112, { id: 8112, name: "Electrocute", icon: "perk-images/Styles/Domination/Electrocute/Electrocute.png" }],
    [8143, { id: 8143, name: "Sudden Impact", icon: "a.png" }],
  ]),
  spells: new Map([[4, { id: "SummonerFlash", key: 4, name: "Flash" }]]),
} as unknown as LibraryData;

const build: SavedBuild = {
  id: "b1",
  name: "Ahri burst",
  championId: 103,
  position: "MIDDLE",
  runes: { primaryStyle: 8100, subStyle: 8300, perks: [8112, 8143, 9999, 8138, 8304, 8345, 5008, 5008, 5001] } as SavedBuild["runes"],
  spells: [4, 14],
  startItems: [1056],
  coreItems: [6655, 424242],
  items: [],
  skillOrder: [1, 3, 2],
  notes: "secret plan",
  collections: [],
  favourite: false,
  source: "custom",
  createdAt: 0,
  updatedAt: 0,
};

const t = (s: string) => s;

describe("cardContent", () => {
  it("resolves what the picture shows and leaves off what Data Dragon no longer knows", () => {
    const card = cardContent(build, data, t, (p) => p.toLowerCase());
    expect(card.title).toBe("Ahri burst");
    expect(card.subtitle).toBe("Ahri, middle");
    expect(card.portrait).toContain("/img/champion/Ahri.png");
    expect(card.keystone?.label).toBe("Electrocute");
    expect(card.primary.map((r) => r.label)).toEqual(["Sudden Impact"]);
    expect(card.spells.map((s) => s.label)).toEqual(["Flash"]);
    expect(card.rows).toEqual([
      { label: "Başlangıç", items: [{ src: expect.stringContaining("/item/1056.png"), label: "Doran's Ring" }] },
      { label: "Çekirdek", items: [{ src: expect.stringContaining("/item/6655.png"), label: "Luden's Companion" }], main: true },
    ]);
    expect(card.skills).toBe("Q > E > W");
  });

  it("never carries the notes", () => {
    expect(JSON.stringify(cardContent(build, data, t, (p) => p.toLowerCase()))).not.toContain("secret");
  });
});
