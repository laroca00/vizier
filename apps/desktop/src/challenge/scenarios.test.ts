import { describe, expect, it } from "vitest";
import { CATEGORIES, SCENARIOS, validateScenario, type Scenario } from "./scenarios";

describe("draft challenge scenarios", () => {
  it("ships at least thirty", () => expect(SCENARIOS.length).toBeGreaterThanOrEqual(30));
  it("has unique ids", () => expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length));
  it("are all well formed", () => {
    for (const s of SCENARIOS) expect(validateScenario(s), s.id).toEqual([]);
  });
  it("spreads over categories and difficulties", () => {
    expect(new Set(SCENARIOS.map((s) => s.category)).size).toBeGreaterThanOrEqual(8);
    for (const d of [1, 2, 3]) expect(SCENARIOS.some((s) => s.difficulty === d)).toBe(true);
    for (const s of SCENARIOS) expect(CATEGORIES).toContain(s.category);
  });
});

describe("validateScenario", () => {
  const ok = SCENARIOS[0];
  const bad = (patch: Partial<Scenario>) => validateScenario({ ...ok, ...patch });
  it("rejects an unknown champion", () => expect(bad({ red: ["Nobody", ...ok.red.slice(1)] })).toContain("unknown champion Nobody"));
  it("rejects a filled player slot", () => expect(bad({ blue: ["Garen", ...ok.blue.slice(1)] })).toContain("the player's slot must be empty"));
  it("rejects an answer already in the draft", () => {
    expect(bad({ accepted: [{ ...ok.accepted[0], champion: "Ahri" }, ok.accepted[1]] }).some((p) => p.includes("already in the draft"))).toBe(true);
  });
  it("needs both languages", () => expect(bad({ lesson: { tr: "x", en: "" } })).toContain("lesson text"));
  it("needs two accepted answers", () => expect(bad({ accepted: [ok.accepted[0]] })).toContain("needs at least two accepted answers"));
});
