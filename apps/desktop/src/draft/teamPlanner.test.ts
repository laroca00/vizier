import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { GAP_MIN_TEAM, planTeam } from "./teamPlanner";

function champion(id: string, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key: id.length, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

const MALPHITE = champion("Malphite", ["Tank", "Fighter"], { defense: 9, magic: 7 });
const JINX = champion("Jinx", ["Marksman"], { attack: 9 });
const LULU = champion("Lulu", ["Support", "Mage"], { magic: 7 });
const ZED = champion("Zed", ["Assassin"], { attack: 9 });
const DRAVEN = champion("Draven", ["Marksman"], { attack: 9 });

describe("planTeam", () => {
  it("names who brings each count", () => {
    const report = planTeam([MALPHITE, JINX, LULU]);
    expect(report.counts.frontline).toContain("Malphite");
    expect(report.counts.hardCc).toContain("Malphite");
    expect(report.picks).toHaveLength(3);
  });
  it("lists synergy pairs with their reasons", () => {
    const report = planTeam([JINX, LULU]);
    expect(report.pairs.find((p) => p.a.id === "Jinx" && p.b.id === "Lulu")?.reasons).toContain("protect");
  });
  it("names no gaps for a team smaller than the minimum", () => {
    expect(GAP_MIN_TEAM).toBe(4);
    expect(planTeam([JINX, ZED, DRAVEN]).gaps).toEqual([]);
  });
  it("names gaps of a full all-physical team", () => {
    const gaps = planTeam([ZED, JINX, DRAVEN, champion("Yasuo", ["Fighter"], { attack: 8, defense: 3 })]).gaps;
    expect(gaps).toContain("noFrontline");
    expect(gaps).toContain("allPhysical");
  });
});
