import { describe, expect, it } from "vitest";
import { CHAMPION_FACTS } from "../quiz/championFacts";
import { CATEGORY_TEXT, COMBO_CATEGORIES, COMBOS, SEQUENCE_TOKEN, combosOf } from "./combos";

const all = COMBOS.champions.flatMap((c) => c.combos.map((combo) => ({ champion: c.championId, combo })));

describe("combo data", () => {
  it("covers at least the first 40 champions, each a real champion once", () => {
    const ids = COMBOS.champions.map((c) => c.championId);
    expect(ids.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !(id in CHAMPION_FACTS))).toEqual([]);
  });
  it("names the patch it was written for", () => {
    expect(COMBOS.writtenFor).toMatch(/^\d+\.\d+$/);
  });
  it("gives every combo a valid category, difficulty and sequence", () => {
    for (const { champion, combo } of all) {
      const where = `${champion}/${combo.id}`;
      expect(COMBO_CATEGORIES, where).toContain(combo.category);
      expect([1, 2, 3], where).toContain(combo.difficulty);
      expect(combo.sequence.length, where).toBeGreaterThanOrEqual(2);
      for (const token of combo.sequence) expect(token, where).toMatch(SEQUENCE_TOKEN);
    }
  });
  it("has unique ids per champion", () => {
    for (const c of COMBOS.champions) expect(new Set(c.combos.map((x) => x.id)).size, c.championId).toBe(c.combos.length);
  });
  it("has short Turkish and English text for every field", () => {
    for (const { champion, combo } of all) {
      for (const field of ["name", "purpose", "timing", "mistake"] as const) {
        for (const lang of ["tr", "en"] as const) {
          const text = combo[field][lang];
          expect(text.trim().length, `${champion}/${combo.id} ${field} ${lang}`).toBeGreaterThan(3);
          expect(text.length, `${champion}/${combo.id} ${field} ${lang}`).toBeLessThanOrEqual(160);
        }
      }
    }
  });
  it("names every category in Turkish", () => {
    expect(Object.keys(CATEGORY_TEXT).sort()).toEqual([...COMBO_CATEGORIES].sort());
  });
  it("looks combos up by Data Dragon id", () => {
    expect(combosOf("Ahri").length).toBeGreaterThan(0);
    expect(combosOf("Nobody")).toEqual([]);
  });
});
