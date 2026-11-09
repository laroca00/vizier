import { describe, expect, it } from "vitest";
import type { Champion } from "./ddragon";
import { COMP_TEMPLATES, TEMPLATE_BY_ID, fittingChampions, satisfies } from "./compTemplates";

function champion(id: string, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key: id.length, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

describe("composition templates", () => {
  it("covers the eleven plans of the brief with unique ids", () => {
    expect(COMP_TEMPLATES).toHaveLength(11);
    expect(new Set(COMP_TEMPLATES.map((t) => t.id)).size).toBe(11);
  });
  it("has both languages, needs, roles and counters that exist", () => {
    for (const t of COMP_TEMPLATES) {
      for (const text of [t.name, t.objective, t.strengths, t.weaknesses, ...t.needs.map((n) => n.lacking)]) expect(text.tr && text.en, t.id).toBeTruthy();
      expect(t.needs.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.roles.length, t.id).toBeGreaterThan(0);
      expect(t.counteredBy.length, t.id).toBeGreaterThan(0);
      for (const c of t.counteredBy) expect(TEMPLATE_BY_ID.has(c), `${t.id} -> ${c}`).toBe(true);
      for (const n of t.needs) {
        expect(n.min).toBeGreaterThan(0);
        expect(!!(n.trait || n.phase || n.archetypes?.length), `${t.id} need has no condition`).toBe(true);
      }
    }
  });
  it("reads a champion against a need", () => {
    const malphite = champion("Malphite", ["Tank", "Fighter"], { defense: 9 });
    const jinx = champion("Jinx", ["Marksman"], { attack: 9 });
    const frontline = TEMPLATE_BY_ID.get("frontToBack")!.needs[0];
    expect(satisfies(frontline, malphite)).toBe(true);
    expect(satisfies(frontline, jinx)).toBe(false);
  });
  it("lists fitting champions with the needs they fill, best fit first", () => {
    const list = fittingChampions(TEMPLATE_BY_ID.get("frontToBack")!, [champion("Jinx", ["Marksman"], { attack: 9 }), champion("Malphite", ["Tank", "Fighter"], { defense: 9 }), champion("Zed", ["Assassin"])]);
    expect(list.map((x) => x.champion.id)).toContain("Jinx");
    expect(list.map((x) => x.champion.id)).not.toContain("Zed");
    expect(list[0].fills.length).toBeGreaterThanOrEqual(list[list.length - 1].fills.length);
  });
});
