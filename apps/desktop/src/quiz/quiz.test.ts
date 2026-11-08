import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { EMOJI_HINTS } from "./emoji";
import { attributesOf, classicGrid, compareClassic, dailyPick, dayKey, emojisShown, rangeOf, skinZoom, streak, type QuizRecord } from "./logic";

function champion(id: string, tags: string[], difficulty: number, partype: string, attackRange: number): Champion {
  return { id, key: id.length, name: id, magic: true, tank: false, tags, info: { attack: 5, defense: 5, magic: 5, difficulty }, partype, attackRange };
}

const AHRI = champion("Ahri", ["Mage", "Assassin"], 5, "Mana", 550);
const ZED = champion("Zed", ["Assassin"], 7, "Enerji", 125);
const LUX = champion("Lux", ["Mage", "Support"], 5, "Mana", 550);

describe("champion riddle", () => {
  it("picks the same answer for everyone on a day and mode", () => {
    const list = ["a", "b", "c", "d", "e", "f", "g"];
    expect(dailyPick(list, "2026-11-08", "classic")).toBe(dailyPick(list, "2026-11-08", "classic"));
    const days = new Set(Array.from({ length: 10 }, (_, i) => dailyPick(list, `2026-11-${10 + i}`, "classic")));
    expect(days.size).toBeGreaterThan(2);
  });

  it("formats the day in local time", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("compares classic attributes with partial matches", () => {
    const result = compareClassic(attributesOf(LUX, ["MIDDLE", "UTILITY"]), attributesOf(AHRI, ["MIDDLE"]));
    expect(result).toEqual({ classes: "partial", resource: "yes", range: "yes", difficulty: "yes", difficultyArrow: null, roles: "partial" });
    const zed = compareClassic(attributesOf(ZED, ["MIDDLE"]), attributesOf(AHRI, ["MIDDLE"]));
    expect(zed.classes).toBe("partial");
    expect(zed.range).toBe("no");
    expect(zed.difficultyArrow).toBe("lower");
    expect(zed.roles).toBe("yes");
  });

  it("shares a classic result as squares without naming the answer", () => {
    const grid = classicGrid([compareClassic(attributesOf(ZED, []), attributesOf(AHRI, [])), compareClassic(attributesOf(AHRI, []), attributesOf(AHRI, []))]);
    expect(grid.split("\n")).toEqual(["🟨🟥🟥🟥🟩", "🟩🟩🟩🟩🟩"]);
    expect(grid).not.toContain("Ahri");
  });

  it("reads range and reveals hints step by step", () => {
    expect(rangeOf(ZED)).toBe("melee");
    expect(rangeOf(AHRI)).toBe("ranged");
    expect(skinZoom(0)).toBeGreaterThan(skinZoom(3));
    expect(skinZoom(99)).toBe(1);
    expect(emojisShown(0, 5)).toBe(1);
    expect(emojisShown(9, 5)).toBe(5);
  });

  it("counts a streak of solved days ending today or yesterday", () => {
    const solved = (day: string): QuizRecord => ({ day, mode: "classic", guesses: [1], solved: true });
    const records = [solved("2026-11-06"), solved("2026-11-07"), { ...solved("2026-11-05"), mode: "skin" as const }];
    expect(streak(records, "classic", "2026-11-08")).toBe(2);
    expect(streak([...records, solved("2026-11-08")], "classic", "2026-11-08")).toBe(3);
    expect(streak(records, "classic", "2026-11-10")).toBe(0);
  });

  it("has at least four emoji hints per champion", () => {
    for (const hints of Object.values(EMOJI_HINTS)) expect(hints.length).toBeGreaterThanOrEqual(4);
  });
});
