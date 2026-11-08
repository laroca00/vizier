import { describe, expect, it } from "vitest";
import { compareRows, cooldownPair, windowLines } from "./abilityCompare";
import type { Ability } from "./ddragon";

const ability = (key: Ability["key"], cooldowns: number[], name = key): Ability => ({ key, name, description: "", cooldowns, image: "" });
const SET = [ability("P", []), ability("Q", [7, 6.5, 6, 5.5, 5]), ability("W", [14, 13, 12, 11, 10]), ability("E", [5, 5, 5, 5, 5]), ability("R", [120, 100, 80])];

describe("cooldownPair", () => {
  it("reads rank 1 and max rank", () => {
    expect(cooldownPair(SET[1])).toEqual({ first: 7, max: 5 });
  });
  it("is null for the passive, a missing ability or zero cooldowns", () => {
    expect(cooldownPair(SET[0])).toBeNull();
    expect(cooldownPair(null)).toBeNull();
    expect(cooldownPair(ability("Q", [0, 0, 0]))).toBeNull();
  });
});

describe("compareRows", () => {
  it("lines the four spells up and leaves gaps", () => {
    const rows = compareRows(SET, SET.slice(0, 3));
    expect(rows.map((r) => r.key)).toEqual(["Q", "W", "E", "R"]);
    expect(rows[2].b).toBeNull();
    expect(rows[1].a?.key).toBe("W");
  });
});

describe("windowLines", () => {
  it("names the longest basic cooldown and the ultimate", () => {
    expect(windowLines(SET)).toEqual([
      { key: "W", name: "W", seconds: 14, ultimate: false },
      { key: "R", name: "R", seconds: 120, ultimate: true },
    ]);
  });
  it("skips basics that come back too fast", () => {
    expect(windowLines([ability("Q", [4]), ability("W", [3]), ability("R", [90])]).map((l) => l.key)).toEqual(["R"]);
  });
  it("is empty without cooldown data", () => {
    expect(windowLines([ability("P", [])])).toEqual([]);
  });
});
