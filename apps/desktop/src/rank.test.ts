import { describe, expect, it } from "vitest";
import { effectiveChoice, regionApplies, resolveRank, sanitizeRank, sanitizeRegion, withRank } from "./rankChoice";

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

describe("withRank with a region", () => {
  it("adds region on tier lists and the champion overview only, then rank", () => {
    expect(withRank("/v1/tierlist/MIDDLE", "emerald_plus", "tr")).toBe("/v1/tierlist/MIDDLE?region=tr");
    expect(withRank("/v1/tierlist/MIDDLE", "all", "kr")).toBe("/v1/tierlist/MIDDLE?region=kr&rank=all");
    expect(withRank("/v1/champions/103?position=TOP", "emerald_plus", "euw")).toBe("/v1/champions/103?position=TOP&region=euw");
    expect(withRank("/v1/champions/103/counters?position=TOP", "emerald_plus", "tr")).toBe("/v1/champions/103/counters?position=TOP");
    expect(withRank("/v1/builds/103", "emerald_plus", "tr")).toBe("/v1/builds/103");
  });
  it("sends no region when pooled", () => {
    expect(withRank("/v1/tierlist/MIDDLE", "emerald_plus", null)).toBe("/v1/tierlist/MIDDLE");
  });
});

describe("regions", () => {
  it("sanitises stored values and knows which brackets have region docs", () => {
    expect(sanitizeRegion("tr")).toBe("tr");
    expect(sanitizeRegion("na")).toBe("all");
    expect(regionApplies("emerald_plus")).toBe(true);
    expect(regionApplies("all")).toBe(true);
    expect(regionApplies("gold_minus")).toBe(false);
  });
});
