import { describe, expect, it } from "vitest";
import { skillSequence } from "./live";

describe("skill order strip", () => {
  const skills = { firstLevels: [1, 2, 3], maxOrder: [1, 2, 3] };
  it("plays out all 18 levels with R on 6, 11 and 16", () => {
    const keys = skillSequence(skills);
    expect(keys).toHaveLength(18);
    expect([keys[5], keys[10], keys[15]]).toEqual(["R", "R", "R"]);
    expect(keys.slice(0, 3)).toEqual(["Q", "W", "E"]);
  });
});
