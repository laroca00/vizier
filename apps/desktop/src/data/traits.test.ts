import { describe, expect, it } from "vitest";
import type { Champion } from "./ddragon";
import { adviceAgainst, analyzeComp, compDimensions, dimensionText } from "./traits";

function champion(id: string, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key: id.length, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

const MALPHITE = champion("Malphite", ["Tank", "Fighter"], { attack: 5, magic: 7, defense: 9 });
const ORIANNA = champion("Orianna", ["Mage", "Support"], { attack: 4, magic: 9, defense: 3 });
const JINX = champion("Jinx", ["Marksman"], { attack: 9, magic: 4, defense: 2 });
const THRESH = champion("Thresh", ["Support", "Fighter"], { attack: 5, magic: 6, defense: 6 });
const XERATH = champion("Xerath", ["Mage"], { attack: 1, magic: 10, defense: 3 });
const ZIGGS = champion("Ziggs", ["Mage"], { attack: 2, magic: 9, defense: 4 });

describe("composition analysis", () => {
  it("names who brings each dimension", () => {
    const dims = Object.fromEntries(compDimensions([MALPHITE, ORIANNA, JINX, THRESH]).map((d) => [d.dimension, d]));
    // Thresh is a Support first in Data Dragon, so he engages but doesn't count as frontline.
    expect(dims.frontline.names).toEqual(["Malphite"]);
    expect(dims.backline.names).toEqual(["Orianna", "Jinx"]);
    expect(dims.pick.names).toEqual(["Thresh"]);
    expect(dims.teamfight.names).toEqual(["Malphite", "Orianna", "Jinx"]);
    expect(dims.poke.names).toEqual(["Orianna"]);
    expect(dimensionText(dims.frontline)).toContain("{names}");
  });

  it("only reports weaknesses once most of the team is in", () => {
    expect(analyzeComp([JINX, XERATH, ZIGGS]).weaknesses).toEqual([]);
    expect(analyzeComp([JINX, XERATH, ZIGGS, ORIANNA]).weaknesses).toContain("noTank");
  });

  it("plans against a poke-heavy enemy", () => {
    const enemy = analyzeComp([XERATH, ZIGGS, JINX]);
    expect(adviceAgainst(enemy, analyzeComp([MALPHITE])).map((a) => a.title)).toContain("Rakip uzaktan yıpratıyor");
  });
});

describe("damage profiles", () => {
  it("has an entry for every champion in the app", async () => {
    const { CHAMPION_FACTS } = await import("../quiz/championFacts");
    const { DAMAGE_PROFILES } = await import("./traits");
    expect(Object.keys(CHAMPION_FACTS).filter((id) => !(id in DAMAGE_PROFILES))).toEqual([]);
    expect(Object.keys(DAMAGE_PROFILES).filter((id) => !(id in CHAMPION_FACTS))).toEqual([]);
  });

  it("keeps every split within 100 percent", async () => {
    const { DAMAGE_PROFILES } = await import("./traits");
    for (const [id, [ap, fixed = 0]] of Object.entries(DAMAGE_PROFILES)) {
      expect(ap + fixed, id).toBeLessThanOrEqual(100);
      expect(ap, id).toBeGreaterThanOrEqual(0);
    }
  });

  it("splits a team's damage and always sums to one", async () => {
    const { damageProfile, teamDamage } = await import("./traits");
    const veigar = champion("Veigar", ["Mage"]);
    const draven = champion("Draven", ["Marksman"]);
    const velkoz = champion("Velkoz", ["Mage"]);
    expect(damageProfile(velkoz)).toEqual({ ap: 0.4, ad: 0, true: 0.6 });
    const team = teamDamage([veigar, draven, velkoz]);
    expect(team.ap).toBeCloseTo((1 + 0 + 0.4) / 3);
    expect(team.ap + team.ad + team.true).toBeCloseTo(1);
    expect(teamDamage([])).toEqual({ ap: 0, ad: 0, true: 0 });
  });

  it("falls back to Data Dragon's ratings for an unknown champion", async () => {
    const { damageProfile } = await import("./traits");
    const profile = damageProfile(champion("NewOne", ["Mage"], { attack: 2, magic: 6 }));
    expect(profile.ap).toBeCloseTo(0.75);
    expect(profile.true).toBe(0);
  });
});

describe("composition 2.0 dimensions", () => {
  it("reports engage, disengage, peel, waveclear and objectives with who brings them", () => {
    const dims = Object.fromEntries(compDimensions([MALPHITE, ORIANNA, JINX, THRESH]).map((d) => [d.dimension, d]));
    expect(Object.keys(dims)).toEqual(["frontline", "backline", "poke", "pick", "teamfight", "engage", "disengage", "peel", "waveclear", "objectives"]);
    expect(dims.engage.names).toContain("Malphite");
    expect(dims.waveclear.names).toEqual(["Orianna", "Jinx"]);
    expect(dims.objectives.names).toEqual(["Jinx"]);
    expect(dims.peel.names).toContain("Thresh");
  });

  it("has text for every dimension and level", () => {
    for (const d of compDimensions([])) {
      expect(dimensionText({ ...d, level: 0 })).toBeTruthy();
      expect(dimensionText({ ...d, level: 1 })).toContain("{names}");
      expect(dimensionText({ ...d, level: 2 })).toContain("{names}");
    }
  });
});
