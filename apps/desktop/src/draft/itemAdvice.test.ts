import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { itemAdvice } from "./itemAdvice";

function champ(id: string, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key: id.length, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

const AP = [champ("Xerath", ["Mage"], { attack: 1, magic: 10 }), champ("Ziggs", ["Mage"], { attack: 2, magic: 9 }), champ("Brand", ["Mage"], { attack: 2, magic: 9 })];
const AD = [champ("Jinx", ["Marksman"], { attack: 9, magic: 2 }), champ("Zed", ["Assassin"], { attack: 9, magic: 1 }), champ("Darius", ["Fighter"], { attack: 9, magic: 1 })];
const ALL = new Set([3165, 3033, 6609, 3075, 3156, 3102, 3143, 3110, 3139, 3157, 3026, 3135, 3036]);
const rules = (enemies: Champion[], pool = ALL) => itemAdvice(enemies, pool).map((a) => a.rule);

describe("situational item advice", () => {
  it("says nothing before three enemies are known", () => {
    expect(itemAdvice(AP.slice(0, 2), ALL)).toEqual([]);
  });

  it("answers a magic-heavy team with magic resist", () => {
    const advice = itemAdvice(AP, ALL);
    expect(advice.map((a) => a.rule)).toContain("magicResist");
    expect(advice.find((a) => a.rule === "magicResist")?.items[0]).toBe(3156);
    expect(rules(AP)).not.toContain("armor");
  });

  it("answers a physical team with armor", () => {
    expect(rules(AD)).toContain("armor");
    expect(rules(AD)).not.toContain("magicResist");
  });

  it("triggers anti-heal from a single healer", () => {
    const healer = [champ("Soraka", ["Support"], { magic: 8 }), AP[0], AD[0]];
    const advice = itemAdvice(healer, ALL).find((a) => a.rule === "antiHeal");
    expect(advice?.names).toEqual(["Soraka"]);
    expect(advice?.items).toContain(3165);
  });

  it("needs three hard CC champions", () => {
    const cc = (n: number) => [champ("Leona", ["Support"]), champ("Nautilus", ["Support"]), champ("Amumu", ["Support"]), champ("Jinx", ["Marksman"]), champ("Zed", ["Assassin"])].slice(0, n).concat(AD.slice(0, 3 - Math.min(n, 3)));
    expect(rules(cc(2))).not.toContain("crowdControl");
    expect(rules(cc(3))).toContain("crowdControl");
  });

  it("flags burst assassins and several tanks", () => {
    const burst = [champ("Zed", ["Assassin"], { attack: 9 }), champ("Talon", ["Assassin"], { attack: 9 }), AD[0]];
    expect(rules(burst)).toContain("burst");
    const tanks = [champ("Ornn", ["Tank"], { defense: 9 }), champ("Sion", ["Tank"], { defense: 9 }), AD[0]];
    expect(rules(tanks)).toContain("tanks");
  });

  it("only suggests items the champion buys", () => {
    expect(itemAdvice(AP, new Set([3143]))).toEqual([]);
    const limited = itemAdvice(AP, new Set([3102, 3143])).find((a) => a.rule === "magicResist");
    expect(limited?.items).toEqual([3102]);
  });
});
