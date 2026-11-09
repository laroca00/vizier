import { describe, expect, it } from "vitest";
import { CHAMPION_FACTS } from "../quiz/championFacts";
import { ARCHETYPES, ARCHETYPE_CHAMPIONS, archetypesOf, championsWith } from "./archetypes";
import { STRENGTH_IDS } from "./strengths";

describe("archetype table", () => {
  it("has 18 archetypes with text in both languages", () => {
    expect(ARCHETYPES).toHaveLength(18);
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(18);
    for (const a of ARCHETYPES) {
      for (const field of [a.name, a.description, a.strength, a.weakness]) {
        expect(field.tr.trim().length, a.id).toBeGreaterThan(3);
        expect(field.en.trim().length, a.id).toBeGreaterThan(3);
      }
    }
  });
  it("covers every champion that has strengths written up", () => {
    expect(STRENGTH_IDS.filter((id) => archetypesOf(id).length === 0)).toEqual([]);
  });
  it("has no unknown champions and 1 to 3 distinct archetypes each", () => {
    for (const id of ARCHETYPE_CHAMPIONS) {
      expect(id in CHAMPION_FACTS, id).toBe(true);
      const list = archetypesOf(id);
      expect(list.length, id).toBeGreaterThanOrEqual(1);
      expect(list.length, id).toBeLessThanOrEqual(3);
      expect(new Set(list.map((a) => a.id)).size, id).toBe(list.length);
    }
  });
  it("gives every archetype at least three champions", () => {
    for (const a of ARCHETYPES) expect(championsWith(a.id).length, a.id).toBeGreaterThanOrEqual(3);
  });
  it("lists the main archetype first", () => {
    expect(archetypesOf("Malphite")[0].id).toBe("vanguard");
    expect(archetypesOf("Nobody")).toEqual([]);
  });
});
