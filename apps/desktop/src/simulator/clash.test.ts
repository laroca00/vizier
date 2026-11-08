import { describe, expect, it } from "vitest";
import type { Champion } from "../data/ddragon";
import { assignRoles, parseClash, planDraft, type ClashPlayer, type Role } from "./clash";

const player = (id: string, roles: Role[], pool: number[] = []): ClashPlayer => ({ id, name: id, roles, pool });

describe("assignRoles", () => {
  it("gives everyone a different role, first choices before second ones", () => {
    const roles = assignRoles([player("a", ["MIDDLE", "TOP"]), player("b", ["MIDDLE", "BOTTOM"]), player("c", ["TOP"])]);
    expect(new Set(roles.values()).size).toBe(3);
    expect(roles.get("c")).toBe("TOP");
    expect([roles.get("a"), roles.get("b")].sort()).toEqual(["BOTTOM", "MIDDLE"]);
  });
});

describe("planDraft", () => {
  // Data Dragon tags drive the traits: a tank, a mage and a marksman.
  const champ = (key: number, id: string, tags: string[], magic: number): Champion =>
    ({ key, id, name: id, tags, magic: magic > 5, tank: tags[0] === "Tank", info: { attack: 10 - magic, defense: tags[0] === "Tank" ? 9 : 3, magic, difficulty: 5 } }) as Champion;
  const champions = new Map<number, Champion>([
    [1, champ(1, "Malphite", ["Tank", "Fighter"], 7)],
    [2, champ(2, "Darius", ["Fighter", "Tank"], 1)],
    [3, champ(3, "Ahri", ["Mage", "Assassin"], 8)],
    [4, champ(4, "Zed", ["Assassin"], 1)],
    [5, champ(5, "Jinx", ["Marksman"], 1)],
  ]);
  const tiers: Record<string, string> = { "1:TOP": "C", "2:TOP": "S", "3:MIDDLE": "B", "4:MIDDLE": "A", "5:BOTTOM": "A" };
  const tierOf = (id: number, role: Role) => tiers[`${id}:${role}`];

  it("uses each player's pool in their role and skips taken champions", () => {
    const players = [player("top", ["TOP"], [1, 2]), player("mid", ["MIDDLE"], [3, 4]), player("adc", ["BOTTOM"], [5])];
    const plan = planDraft(players, { champions, tierOf, unavailable: new Set([4]) });
    expect(plan.team[2]).toBe(3);
    expect(plan.team[3]).toBe(5);
    expect([1, 2]).toContain(plan.team[0]);
    expect(plan.empty).toEqual([]);
  });

  it("reports a player whose whole pool is gone", () => {
    const plan = planDraft([player("mid", ["MIDDLE"], [3])], { champions, tierOf, unavailable: new Set([3]) });
    expect(plan.empty).toEqual(["mid"]);
    expect(plan.picks).toEqual([]);
  });

  it("falls back to an off-role pick when the pool has nothing for the role", () => {
    const plan = planDraft([player("sup", ["UTILITY"], [5])], { champions, tierOf, unavailable: new Set() });
    expect(plan.picks).toEqual([{ playerId: "sup", role: "UTILITY", championId: 5, offRole: true }]);
  });

  it("doesn't call a pick off role when the role lists are missing", () => {
    const plan = planDraft([player("sup", ["UTILITY"], [5])], { champions, tierOf: () => undefined, unavailable: new Set(), rolesKnown: false });
    expect(plan.picks[0].offRole).toBe(false);
  });
});

describe("parseClash", () => {
  it("keeps valid players and drops junk", () => {
    expect(parseClash('[{"id":"a","name":"Ali","roles":["TOP","X"],"pool":[1,"2",3]},{"name":"no id"}]')).toEqual([{ id: "a", name: "Ali", roles: ["TOP"], pool: [1, 3] }]);
    expect(parseClash("not json")).toEqual([]);
  });
});
