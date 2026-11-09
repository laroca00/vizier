import { describe, expect, it } from "vitest";
import { cleanBracket, cleanChoice, rankParam, resolveBracket, withRank } from "./rank";

describe("rank choice", () => {
  it("keeps valid choices and sends anything else to Emerald+", () => {
    expect(cleanChoice("gold_minus")).toBe("gold_minus");
    expect(cleanChoice("mine")).toBe("mine");
    for (const bad of [undefined, null, 3, "", "bronze", {}]) expect(cleanChoice(bad)).toBe("emerald_plus");
    expect(cleanBracket("all")).toBe("all");
    expect(cleanBracket("mine")).toBeNull();
  });

  it("resolves 'my rank' to the player's bracket, else Emerald+", () => {
    expect(resolveBracket("mine", "platinum_plus")).toBe("platinum_plus");
    expect(resolveBracket("mine", null)).toBe("emerald_plus");
    expect(resolveBracket("all", "platinum_plus")).toBe("all");
  });

  it("builds the query without touching Emerald+ requests", () => {
    expect(rankParam("emerald_plus")).toBeNull();
    expect(withRank("/v1/tierlist/TOP", "emerald_plus")).toBe("/v1/tierlist/TOP");
    expect(withRank("/v1/tierlist/TOP", "all")).toBe("/v1/tierlist/TOP?rank=all");
    expect(withRank("/v1/builds/1?position=TOP", "master_plus")).toBe("/v1/builds/1?position=TOP&rank=master_plus");
  });
});
