import { describe, expect, it } from "vitest";
import { effectiveChoice, resolveRank, sanitizeRank, withRank } from "./rankChoice";

describe("sanitizeRank", () => {
  it("keeps known choices and defaults anything else to Emerald+", () => {
    expect(sanitizeRank("gold_minus")).toBe("gold_minus");
    expect(sanitizeRank("mine")).toBe("mine");
    expect(sanitizeRank(undefined)).toBe("emerald_plus");
    expect(sanitizeRank("bronze")).toBe("emerald_plus");
    expect(sanitizeRank(3)).toBe("emerald_plus");
  });
});

describe("resolveRank", () => {
  it("uses the player's rank for 'mine', or falls back with a flag", () => {
    expect(resolveRank("mine", "gold_minus")).toEqual({ bracket: "gold_minus", fellBack: false });
    expect(resolveRank("mine", null)).toEqual({ bracket: "emerald_plus", fellBack: true });
    expect(resolveRank("all", "gold_minus")).toEqual({ bracket: "all", fellBack: false });
  });
});

describe("withRank", () => {
  it("adds rank to the stats routes unless it is Emerald+", () => {
    expect(withRank("/v1/tierlist/MIDDLE", "emerald_plus")).toBe("/v1/tierlist/MIDDLE");
    expect(withRank("/v1/tierlist/MIDDLE", "gold_minus")).toBe("/v1/tierlist/MIDDLE?rank=gold_minus");
    expect(withRank("/v1/tierlist/MIDDLE?queue=420", "all")).toBe("/v1/tierlist/MIDDLE?queue=420&rank=all");
    expect(withRank("/v1/builds/103?position=MIDDLE&vs=238", "master_plus")).toBe("/v1/builds/103?position=MIDDLE&vs=238&rank=master_plus");
    expect(withRank("/v1/champions/103", "all")).toBe("/v1/champions/103?rank=all");
    expect(withRank("/v1/champions/103/counters?position=TOP", "all")).toBe("/v1/champions/103/counters?position=TOP&rank=all");
    expect(withRank("/v1/champions/103/lane?position=TOP&vs=1", "all")).toBe("/v1/champions/103/lane?position=TOP&vs=1&rank=all");
  });

  it("leaves unbracketed routes and paths that already carry a rank", () => {
    for (const path of ["/v1/builds/index", "/v1/builds/history/103?position=TOP", "/v1/champions/103/item-times?position=TOP", "/v1/bans", "/v1/pros/builds", "/v1/augments/1700", "/v1/meta/coverage"]) {
      expect(withRank(path, "gold_minus")).toBe(path);
    }
    expect(withRank("/v1/tierlist/TOP?rank=all", "gold_minus")).toBe("/v1/tierlist/TOP?rank=all");
  });
});

describe("effectiveChoice", () => {
  it("follows the player's own rank only in champ select, with the setting on and the rank known", () => {
    expect(effectiveChoice("all", true, "gold_minus", true)).toBe("mine");
    expect(effectiveChoice("all", false, "gold_minus", true)).toBe("all");
    expect(effectiveChoice("all", true, "gold_minus", false)).toBe("all");
    expect(effectiveChoice("all", true, null, true)).toBe("all");
  });
});
