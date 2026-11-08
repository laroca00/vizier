import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { findChampion, guessPosition, isComplete, parseMatchupQuery, swapSides, type MatchupRoute } from "./matchupRoute";

const champ = (key: number, name: string, tag?: string) => ({ key, name, id: name, tags: tag ? [tag] : [] }) as unknown as Champion;
const list = [champ(145, "Kai'Sa", "Marksman"), champ(103, "Ahri", "Mage"), champ(238, "Zed", "Assassin"), champ(10, "Darius", "Fighter"), champ(412, "Thresh", "Support")];
const route = (championId: number | null, opponentId: number | null): MatchupRoute => ({ page: "matchup", championId, opponentId, position: "MIDDLE" });

describe("findChampion", () => {
  it("matches names ignoring case and punctuation", () => {
    expect(findChampion(list, "kaisa")?.key).toBe(145);
    expect(findChampion(list, " AHRİ ")?.key).toBe(103);
  });
  it("needs the whole name", () => {
    expect(findChampion(list, "Ah")).toBeNull();
    expect(findChampion(list, "")).toBeNull();
  });
});

describe("matchup route", () => {
  it("swaps the sides and keeps the role", () => {
    expect(swapSides(route(103, 238))).toEqual({ page: "matchup", championId: 238, opponentId: 103, position: "MIDDLE" });
  });
  it("is complete with two different champions only", () => {
    expect(isComplete(route(103, 238))).toBe(true);
    expect(isComplete(route(103, 103))).toBe(false);
    expect(isComplete(route(103, null))).toBe(false);
  });
});

describe("parseMatchupQuery", () => {
  it("reads 'A vs B' in any case", () => {
    const parsed = parseMatchupQuery("ahri VS zed", list);
    expect([parsed?.a.key, parsed?.b.key]).toEqual([103, 238]);
  });
  it("accepts a start of the second name while typing", () => {
    expect(parseMatchupQuery("Ahri vs Ze", list)?.b.key).toBe(238);
  });
  it("needs two different champions", () => {
    expect(parseMatchupQuery("Ahri vs Ahri", list)).toBeNull();
    expect(parseMatchupQuery("Ahri vs ", list)).toBeNull();
    expect(parseMatchupQuery("Ahri", list)).toBeNull();
    expect(parseMatchupQuery("Nobody vs Zed", list)).toBeNull();
  });
});

describe("guessPosition", () => {
  it("maps the main class to a role", () => {
    expect(list.map(guessPosition)).toEqual(["BOTTOM", "MIDDLE", "MIDDLE", "TOP", "UTILITY"]);
  });
});
