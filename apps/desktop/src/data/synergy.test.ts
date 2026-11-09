import { describe, expect, it } from "vitest";
import type { Champion } from "./ddragon";
import { groupByCategory, sortByData, synergyRows } from "./synergyList";
import { SYNERGY_CATEGORIES, SYNERGY_TEXT, synergyReasons } from "./synergyReasons";

function champion(id: string, key: number, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

const MALPHITE = champion("Malphite", 54, ["Tank", "Fighter"], { defense: 9, magic: 7 });
const ORIANNA = champion("Orianna", 61, ["Mage", "Support"], { magic: 9 });
const JINX = champion("Jinx", 222, ["Marksman"], { attack: 9 });
const LULU = champion("Lulu", 117, ["Support", "Mage"], { magic: 7 });
const LUX = champion("Lux", 99, ["Mage", "Support"], { magic: 9 });
const KAYLE = champion("Kayle", 10, ["Fighter", "Support"]);
const VAYNE = champion("Vayne", 67, ["Marksman", "Assassin"], { attack: 9 });

describe("synergyReasons", () => {
  it("is symmetric", () => {
    for (const [a, b] of [[MALPHITE, ORIANNA], [JINX, LULU], [KAYLE, VAYNE]]) expect(synergyReasons(a, b).sort()).toEqual(synergyReasons(b, a).sort());
  });
  it("finds engage plus follow-up control", () => {
    expect(synergyReasons(MALPHITE, LUX)).toContain("engage");
  });
  it("finds a carry with a protector", () => {
    expect(synergyReasons(JINX, LULU)).toContain("protect");
  });
  it("finds two late-game champions", () => {
    expect(synergyReasons(KAYLE, VAYNE)).toContain("scaling");
  });
  it("has a Turkish name and reason for every category", () => {
    for (const c of SYNERGY_CATEGORIES) expect(SYNERGY_TEXT[c].name && SYNERGY_TEXT[c].reason).toBeTruthy();
  });
});

describe("synergyRows", () => {
  const champions = new Map([MALPHITE, ORIANNA, JINX, LULU].map((c) => [c.key, c]));
  const allies = [
    { championId: 222, position: "BOTTOM", games: 4000, winRate: 0.53 },
    { championId: 117, position: "UTILITY", games: 3000, winRate: 0.55 },
    { championId: 61, position: "MIDDLE", games: 6, winRate: 0.9 },
    { championId: 54, position: "TOP", games: 5000, winRate: 0.5 },
  ];
  it("keeps data rows only for judgeable samples", () => {
    const rows = synergyRows(JINX, champions, allies, null);
    expect(rows.find((r) => r.champion.id === "Orianna")?.data).toBeNull();
    expect(rows.find((r) => r.champion.id === "Lulu")?.data).toMatchObject({ games: 3000 });
  });
  it("leaves reason-only rows out when a role is chosen", () => {
    const rows = synergyRows(JINX, champions, allies, "UTILITY");
    expect(rows.map((r) => r.champion.id)).toEqual(["Lulu"]);
  });
  it("never lists the champion itself", () => {
    expect(synergyRows(JINX, champions, allies, null).some((r) => r.champion.id === "Jinx")).toBe(false);
  });
  it("sorts data rows by win rate, before reason-only rows", () => {
    const sorted = sortByData(synergyRows(MALPHITE, champions, allies, null), "tr");
    const withData = sorted.filter((r) => r.data);
    expect(withData.map((r) => r.data!.winRate)).toEqual([...withData.map((r) => r.data!.winRate)].sort((a, b) => b - a));
    expect(sorted.findIndex((r) => !r.data)).toBeGreaterThanOrEqual(withData.length);
  });
  it("groups under every reason", () => {
    const groups = groupByCategory(synergyRows(JINX, champions, allies, null), "tr");
    expect(groups.find((g) => g.category === "protect")?.rows.map((r) => r.champion.id)).toContain("Lulu");
  });
});
