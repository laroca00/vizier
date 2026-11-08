import { describe, expect, it } from "vitest";
import { duel, growthFactor, statAt } from "./duel";

// Ahri's base stats as Data Dragon lists them.
const AHRI = { hp: 590, hpperlevel: 104, armor: 21, armorperlevel: 4.7, spellblock: 30, spellblockperlevel: 1.3, attackdamage: 53, attackdamageperlevel: 3, attackspeed: 0.668, attackspeedperlevel: 2, attackrange: 550 };
const ZED = { hp: 654, hpperlevel: 99, armor: 32, armorperlevel: 4.7, spellblock: 32, spellblockperlevel: 2.05, attackdamage: 63, attackdamageperlevel: 3.4, attackspeed: 0.651, attackspeedperlevel: 3.3, attackrange: 125 };

describe("growthFactor", () => {
  it("is 0 at level 1 and 17 at level 18", () => {
    expect(growthFactor(1)).toBe(0);
    expect(growthFactor(18)).toBeCloseTo(17, 10);
  });
  it("matches the wiki curve at level 6", () => {
    expect(growthFactor(6)).toBeCloseTo(3.95, 10);
  });
});

describe("statAt", () => {
  it("starts at the base value", () => {
    expect(statAt(AHRI, "hp", 1)).toBe(590);
    expect(statAt(AHRI, "attackspeed", 1)).toBe(0.668);
  });
  it("adds the scaled growth", () => {
    expect(statAt(AHRI, "hp", 18)).toBeCloseTo(2358, 6);
    expect(statAt(AHRI, "armor", 6)).toBeCloseTo(21 + 4.7 * 3.95, 6);
  });
  it("grows attack speed as a share of the base and leaves range alone", () => {
    expect(statAt(AHRI, "attackspeed", 18)).toBeCloseTo(0.668 * 1.34, 6);
    expect(statAt(AHRI, "attackrange", 18)).toBe(550);
  });
  it("treats a missing stat as zero", () => {
    expect(statAt({}, "armor", 5)).toBe(0);
  });
});

describe("duel", () => {
  const rows = duel(AHRI, ZED);
  it("names who is ahead at each level", () => {
    expect(rows.hp[1].ahead).toBe("b");
    expect(rows.attackrange[11].ahead).toBe("a");
    expect(rows.armor[18].ahead).toBe("b");
  });
  it("calls near-equal values even", () => {
    expect(duel({ hp: 600 }, { hp: 602 }).hp[1].ahead).toBe("even");
  });
  it("covers every level", () => {
    expect(Object.keys(rows.hp).map(Number)).toEqual([1, 3, 6, 11, 18]);
  });
});
