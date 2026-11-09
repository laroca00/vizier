import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { draftCardContent } from "./draftCard";

const champ = (key: number, id: string, tags: string[]): Champion => ({ key, id, name: id, tags, magic: false, tank: tags[0] === "Tank", info: { attack: 5, defense: 5, magic: 5, difficulty: 5 } }) as unknown as Champion;
const champions = new Map<number, Champion>([
  [1, champ(1, "Xerath", ["Mage"])],
  [2, champ(2, "Ziggs", ["Mage"])],
  [3, champ(3, "Jayce", ["Fighter"])],
  [4, champ(4, "Janna", ["Support"])],
  [5, champ(5, "Varus", ["Marksman"])],
  [6, champ(6, "Zed", ["Assassin"])],
]);

describe("draftCardContent", () => {
  it("keeps empty slots in place, names bans and waits for four picks before a plan", () => {
    const card = draftCardContent({ blue: [1, 0, 3, 0, 0], red: [6, 0, 0, 0, 0], bans: [2, 999] }, champions, "16.22.1", "Clash", (s) => s);
    expect(card.blue.picks.map((p) => p.name)).toEqual(["Xerath", "", "Jayce", "", ""]);
    expect(card.blue.picks[1].icon).toBeNull();
    expect(card.blue.picks[0].icon).toContain("/champion/Xerath.png");
    expect(card.blue.plan).toBeNull();
    expect(card.bans.map((b) => b.name)).toEqual(["Ziggs"]);
  });

  it("names a plan once most of the team is in", () => {
    const card = draftCardContent({ blue: [1, 2, 3, 4, 0], red: [0, 0, 0, 0, 0], bans: [] }, champions, "16.22.1", "Clash", (s) => s);
    expect(card.blue.plan).toBe("Uzaktan yıpratma");
  });
});
