import { describe, expect, it } from "vitest";
import { CHAMPION_FACTS } from "../quiz/championFacts";
import { DIFFICULTY_AREAS, DIFFICULTY_BREAKDOWN_IDS, difficultyBreakdownOf } from "./difficultyBreakdown";

describe("difficulty breakdown", () => {
  it("covers every champion the app knows", () => {
    const champions = Object.keys(CHAMPION_FACTS).filter((id) => /^[A-Z]/.test(id));
    expect(champions.filter((id) => !difficultyBreakdownOf(id))).toEqual([]);
  });
  it("has no entries for unknown champions", () => {
    expect(DIFFICULTY_BREAKDOWN_IDS.filter((id) => !(id in CHAMPION_FACTS))).toEqual([]);
  });
  it("has one level from 1 to 3 per area", () => {
    for (const id of DIFFICULTY_BREAKDOWN_IDS) {
      const b = difficultyBreakdownOf(id)!;
      for (const area of DIFFICULTY_AREAS) expect([1, 2, 3], `${id} ${area}`).toContain(b[area]);
    }
  });
  it("reads digits in area order", () => {
    expect(difficultyBreakdownOf("Garen")).toMatchObject({ mechanics: 1, consistency: 1 });
    expect(difficultyBreakdownOf("Nope")).toBeNull();
  });
});
