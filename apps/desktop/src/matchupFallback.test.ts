import { describe, expect, it } from "vitest";
import type { Champion } from "./data/ddragon";
import { standInMatchup } from "./matchupFallback";

const champ = (key: number, hp: number): Champion =>
  ({ id: `C${key}`, key, name: `C${key}`, magic: false, tank: false, tags: ["Fighter"], info: { attack: 5, defense: 5, magic: 2, difficulty: 5 }, baseStats: { hp, armor: 35, mr: 30, ad: 60, speed: 340 }, attackRange: 175 }) as Champion;

const all = [champ(1, 600), champ(2, 610), champ(3, 620), champ(4, 630)];

describe("standInMatchup", () => {
  it("pools the games against similar opponents, weighted by games", () => {
    const result = standInMatchup(
      [{ championId: 2, games: 60, winRate: 0.5 }, { championId: 3, games: 40, winRate: 0.6 }, { championId: 4, games: 5, winRate: 1 }],
      all[0],
      all,
    );
    expect(result?.games).toBe(100);
    expect(result?.winRate).toBeCloseTo(0.54);
    expect(result?.from.map((f) => f.champion.key)).toEqual([2, 3]);
  });

  it("gives up when the pool is thin", () => {
    expect(standInMatchup([{ championId: 2, games: 30, winRate: 0.5 }], all[0], all)).toBeNull();
  });

  it("ignores opponents of another class", () => {
    const other = { ...all[1], tags: ["Mage"] } as Champion;
    expect(standInMatchup([{ championId: 2, games: 200, winRate: 0.5 }], all[0], [all[0], other])).toBeNull();
  });
});
