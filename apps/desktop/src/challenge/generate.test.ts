import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { damageProfile, traitsOf } from "../data/traits";
import { GENERATED_KINDS, generateScenario, generateSet, suits } from "./generate";
import { validateScenario } from "./scenarios";
import { grade } from "./session";

const ROSTER: [string, string[], number?][] = [
  ["Malphite", ["Tank", "Fighter"]], ["Ornn", ["Tank", "Fighter"]], ["Sion", ["Tank", "Fighter"]], ["Garen", ["Fighter", "Tank"]], ["Darius", ["Fighter", "Tank"]], ["Fiora", ["Fighter", "Assassin"]], ["Jax", ["Fighter", "Assassin"]], ["Teemo", ["Marksman", "Assassin"]],
  ["Sejuani", ["Tank", "Fighter"]], ["Vi", ["Fighter", "Assassin"]], ["Khazix", ["Assassin"]], ["Elise", ["Mage", "Fighter"]], ["Zed", ["Assassin"]], ["Nocturne", ["Assassin", "Fighter"]], ["Amumu", ["Tank", "Mage"]], ["Hecarim", ["Fighter", "Tank"]],
  ["Ahri", ["Mage", "Assassin"]], ["Syndra", ["Mage", "Support"]], ["Viktor", ["Mage"]], ["Talon", ["Assassin"]], ["Katarina", ["Assassin", "Mage"]], ["Orianna", ["Mage", "Support"]], ["Lux", ["Mage", "Support"]], ["Annie", ["Mage"]], ["Akali", ["Assassin"]], ["Fizz", ["Assassin", "Fighter"]],
  ["Jinx", ["Marksman"]], ["Caitlyn", ["Marksman"]], ["Ashe", ["Marksman", "Support"]], ["Draven", ["Marksman"]], ["Kaisa", ["Marksman"]], ["Vayne", ["Marksman", "Assassin"]], ["Ezreal", ["Marksman", "Mage"]], ["Lucian", ["Marksman"]], ["Jhin", ["Marksman", "Mage"]], ["Sivir", ["Marksman"]], ["Tristana", ["Marksman", "Assassin"]],
  ["Leona", ["Tank", "Support"]], ["Alistar", ["Tank", "Support"]], ["Janna", ["Support", "Mage"]], ["Lulu", ["Support", "Mage"]], ["Soraka", ["Support", "Mage"]], ["Nami", ["Support", "Mage"]], ["Braum", ["Support", "Tank"]], ["Thresh", ["Support", "Fighter"]], ["Brand", ["Mage", "Support"]], ["Zyra", ["Mage", "Support"]], ["Karma", ["Support", "Mage"]], ["Nautilus", ["Tank", "Fighter"]], ["Taric", ["Support", "Fighter"]], ["Zilean", ["Support", "Mage"]],
];

function roster(): Champion[] {
  return ROSTER.map(([id, tags], i) => ({ id, key: i + 1, name: id, magic: false, tank: tags[0] === "Tank", tags, info: { attack: 5, defense: tags[0] === "Tank" ? 9 : 4, magic: tags[0] === "Mage" ? 9 : 4, difficulty: 5 } }));
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("generateScenario", () => {
  const champions = roster();
  for (const kind of GENERATED_KINDS) {
    it(`makes valid ${kind} scenarios`, () => {
      let made = 0;
      for (let seed = 1; seed <= 8; seed++) {
        const s = generateScenario(kind, champions, seeded(seed), seed);
        if (!s) continue;
        made++;
        expect(validateScenario(s), `${kind} ${seed}`).toEqual([]);
        expect(s.generated).toBe(true);
      }
      expect(made).toBeGreaterThan(0);
    });
  }

  it("builds the gap into the team", () => {
    const byId = new Map(champions.map((c) => [c.id, c]));
    for (let seed = 1; seed <= 6; seed++) {
      const s = generateScenario("noEngage", champions, seeded(seed), seed);
      if (!s) continue;
      for (const id of s.blue) if (id) expect(traitsOf(byId.get(id)!).engage, id).toBe(false);
    }
  });

  it("grades answers by the rule itself", () => {
    const byId = new Map(champions.map((c) => [c.id, c]));
    for (let seed = 1; seed <= 6; seed++) {
      const s = generateScenario("allPhysical", champions, seeded(seed), seed);
      if (!s) continue;
      for (const a of s.accepted) expect(damageProfile(byId.get(a.champion)!).ap, a.champion).toBeGreaterThanOrEqual(0.6);
      for (const a of s.rejected) expect(damageProfile(byId.get(a.champion)!).ap, a.champion).toBeLessThan(0.6);
      expect(grade(s, s.accepted[0].champion)).toBe("accepted");
      expect(grade(s, s.rejected[0].champion)).toBe("rejected");
    }
  });

  it("only offers champions that suit the role", () => {
    const byId = new Map(champions.map((c) => [c.id, c]));
    const s = generateScenario("noEngage", champions, seeded(3), 3);
    expect(s).not.toBeNull();
    for (const a of [...s!.accepted, ...s!.rejected]) expect(suits(s!.role, byId.get(a.champion)!)).toBe(true);
  });

  it("returns null for a pool too small to be fair", () => {
    expect(generateScenario("noEngage", champions.slice(0, 3), seeded(1))).toBeNull();
  });
});

describe("generateSet", () => {
  it("takes the kinds in turn", () => {
    const set = generateSet(8, roster(), seeded(7));
    expect(set.length).toBeGreaterThan(0);
    expect(new Set(set.map((s) => s.id)).size).toBe(set.length);
  });
});
