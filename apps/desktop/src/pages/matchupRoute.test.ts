import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { findChampion, isComplete, swapSides, type MatchupRoute } from "./matchupRoute";

const champ = (key: number, name: string) => ({ key, name, id: name, tags: [] }) as unknown as Champion;
const list = [champ(145, "Kai'Sa"), champ(103, "Ahri")];
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
