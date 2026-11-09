import { describe, expect, it } from "vitest";
import { COMP_TEMPLATES } from "./compTemplates";
import { closestTemplates, fillers, matchTemplate, MATCH_MIN_TEAM } from "./compMatch";
import type { Champion } from "./ddragon";

function champion(id: string, key: number, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

const MALPHITE = champion("Malphite", 54, ["Tank", "Fighter"], { defense: 9, magic: 7 });
const ORNN = champion("Ornn", 516, ["Tank", "Fighter"], { defense: 9 });
const JINX = champion("Jinx", 222, ["Marksman"], { attack: 9 });
const ASHE = champion("Ashe", 22, ["Marksman", "Support"], { attack: 7 });
const LULU = champion("Lulu", 117, ["Support", "Mage"], { magic: 7 });

describe("matchTemplate", () => {
  const frontToBack = COMP_TEMPLATES.find((t) => t.id === "frontToBack")!;
  it("counts met needs and who brings them", () => {
    const m = matchTemplate(frontToBack, [MALPHITE, ORNN, JINX, ASHE]);
    expect(m.needs[0]).toMatchObject({ met: true });
    expect(m.needs[0].have).toEqual(["Malphite", "Ornn"]);
    expect(m.needs[1].met).toBe(true);
  });
  it("gives partial progress for a need that is one short", () => {
    const m = matchTemplate(frontToBack, [MALPHITE, JINX]);
    expect(m.progress).toBeGreaterThan(0);
    expect(m.progress).toBeLessThan(1);
    expect(m.needs[0]).toMatchObject({ met: false });
  });
});

describe("closestTemplates", () => {
  it("returns nothing for a team below the minimum", () => {
    expect(closestTemplates([MALPHITE, JINX])).toEqual([]);
    expect(MATCH_MIN_TEAM).toBe(3);
  });
  it("puts the most complete plan first and respects the limit", () => {
    const list = closestTemplates([MALPHITE, ORNN, JINX, LULU], 2);
    expect(list).toHaveLength(2);
    expect(list[0].progress).toBeGreaterThanOrEqual(list[1].progress);
  });
});

describe("fillers", () => {
  const need = COMP_TEMPLATES.find((t) => t.id === "frontToBack")!.needs[0];
  it("lists pool champions first and skips unavailable ones", () => {
    const list = fillers(need, [MALPHITE, ORNN, JINX], new Set([516]), new Set());
    expect(list.map((c) => c.id)).toEqual(["Ornn", "Malphite"]);
    expect(fillers(need, [MALPHITE, ORNN], new Set(), new Set([516])).map((c) => c.id)).toEqual(["Malphite"]);
  });
});
