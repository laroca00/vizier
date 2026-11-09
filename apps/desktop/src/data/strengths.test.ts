import { describe, expect, it } from "vitest";
import { CHAMPION_FACTS } from "../quiz/championFacts";
import { STRENGTH_IDS, STRENGTH_TEXT, strengthsOf, WEAKNESS_TEXT } from "./strengths";

describe("strengths table", () => {
  it("covers every champion the app knows", () => {
    const champions = Object.keys(CHAMPION_FACTS).filter((id) => /^[A-Z]/.test(id));
    expect(champions.filter((id) => !strengthsOf(id))).toEqual([]);
  });
  it("has no entries for unknown champions", () => {
    expect(STRENGTH_IDS.filter((id) => !(id in CHAMPION_FACTS))).toEqual([]);
  });
  it("uses only listed keys, 2 or 3 strengths and 1 or 2 weaknesses, without repeats", () => {
    for (const id of STRENGTH_IDS) {
      const { strengths, weaknesses } = strengthsOf(id)!;
      expect(strengths.length, id).toBeGreaterThanOrEqual(2);
      expect(strengths.length, id).toBeLessThanOrEqual(3);
      expect(weaknesses.length, id).toBeGreaterThanOrEqual(1);
      expect(weaknesses.length, id).toBeLessThanOrEqual(2);
      expect(new Set(strengths).size, id).toBe(strengths.length);
      expect(new Set(weaknesses).size, id).toBe(weaknesses.length);
      for (const s of strengths) expect(s in STRENGTH_TEXT, `${id}: ${s}`).toBe(true);
      for (const w of weaknesses) expect(w in WEAKNESS_TEXT, `${id}: ${w}`).toBe(true);
    }
  });
});
