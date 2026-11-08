import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { winConditions } from "./winConditions";

function champ(id: string, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key: id.length, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

describe("win conditions", () => {
  it("needs three champions", () => {
    expect(winConditions([champ("Xerath", ["Mage"]), champ("Ziggs", ["Mage"])])).toEqual([]);
  });

  it("reads a poke draft", () => {
    const team = [champ("Xerath", ["Mage"]), champ("Ziggs", ["Mage"]), champ("Jayce", ["Fighter"]), champ("Janna", ["Support"])];
    const result = winConditions(team);
    expect(result[0].archetype).toBe("poke");
    expect(result[0].names).toEqual(["Xerath", "Ziggs", "Jayce"]);
  });

  it("reads a split push draft", () => {
    const team = [champ("Fiora", ["Fighter"]), champ("Tryndamere", ["Fighter"]), champ("Janna", ["Support"])];
    expect(winConditions(team)[0].archetype).toBe("split");
  });

  it("reads a dive draft", () => {
    const team = [champ("Vi", ["Fighter"]), champ("Zed", ["Assassin"]), champ("Leona", ["Tank"]), champ("Hecarim", ["Fighter"])];
    expect(winConditions(team).map((w) => w.archetype)).toContain("dive");
  });

  it("returns nothing for a draft with no clear style", () => {
    const team = [champ("Garen", ["Fighter"]), champ("Ashe", ["Marksman"]), champ("Soraka", ["Support"])];
    expect(winConditions(team).length).toBeLessThanOrEqual(1);
  });
});
