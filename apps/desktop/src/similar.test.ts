import { describe, expect, it } from "vitest";
import type { Champion } from "./data/ddragon";
import { similarChampions, statDistance } from "./similar";

function champ(key: number, tag: string, magic: boolean, hp: number, ad = 55): Champion {
  return {
    id: `C${key}`, key, name: `C${key}`, magic, tank: false, tags: [tag], info: { attack: 5, defense: 5, magic: 5, difficulty: 5 },
    attackRange: 175, baseStats: { hp, armor: 30, mr: 32, ad, speed: 340 },
  };
}

describe("similarChampions", () => {
  const self = champ(1, "Mage", true, 560);
  it("keeps the same class and damage type, nearest stats first", () => {
    const list = [champ(2, "Mage", true, 600), champ(3, "Mage", true, 570), champ(4, "Mage", false, 565), champ(5, "Fighter", true, 560), self];
    expect(similarChampions(self, list, 5).map((c) => c.key)).toEqual([3, 2]);
  });
  it("respects the limit", () => {
    expect(similarChampions(self, [champ(2, "Mage", true, 600), champ(3, "Mage", true, 570)], 1)).toHaveLength(1);
  });
  it("skips champions without stats", () => {
    const bare = { ...champ(6, "Mage", true, 560), baseStats: undefined };
    expect(statDistance(self, bare)).toBeNull();
    expect(similarChampions(self, [bare], 3)).toEqual([]);
  });
});
