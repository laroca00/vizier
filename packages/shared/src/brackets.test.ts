import { describe, expect, it } from "vitest";
import {
  BRACKETS,
  BRACKET_LABELS,
  DEFAULT_BRACKET,
  GROUP_LABELS,
  TIER_GROUPS,
  bracketOfTier,
  bracketsContaining,
  groupsOf,
  parseBracket,
} from "./brackets.ts";

describe("bracketOfTier", () => {
  it.each([
    ["IRON", "iron_bronze"],
    ["BRONZE", "iron_bronze"],
    ["SILVER", "silver"],
    ["GOLD", "gold"],
    ["PLATINUM", "platinum"],
    ["EMERALD", "emerald"],
    ["DIAMOND", "diamond"],
    ["MASTER", "master_plus"],
    ["GRANDMASTER", "master_plus"],
    ["CHALLENGER", "master_plus"],
    ["challenger", "master_plus"],
  ])("%s -> %s", (tier, group) => expect(bracketOfTier(tier)).toBe(group));

  it("returns null for unknown tiers", () => {
    expect(bracketOfTier("WOOD")).toBeNull();
    expect(bracketOfTier("")).toBeNull();
    expect(bracketOfTier(null)).toBeNull();
  });
});

describe("brackets", () => {
  it("emerald_plus is the default and covers today's data", () => {
    expect(DEFAULT_BRACKET).toBe("emerald_plus");
    expect(groupsOf("emerald_plus")).toEqual(["emerald", "diamond", "master_plus"]);
  });

  it("each bracket is a sum of groups", () => {
    expect(groupsOf("all")).toEqual(TIER_GROUPS);
    expect(groupsOf("gold_minus")).toEqual(["iron_bronze", "silver", "gold"]);
    expect(groupsOf("platinum_plus")).toEqual(["platinum", "emerald", "diamond", "master_plus"]);
    expect(groupsOf("diamond_plus")).toEqual(["diamond", "master_plus"]);
    expect(groupsOf("master_plus")).toEqual(["master_plus"]);
  });

  it("bracketsContaining agrees with groupsOf for every group", () => {
    for (const g of TIER_GROUPS) {
      expect(bracketsContaining(g)).toEqual(BRACKETS.filter((b) => groupsOf(b).includes(g)));
      expect(bracketsContaining(g)).toContain("all");
    }
    expect(bracketsContaining("silver")).toEqual(["all", "gold_minus"]);
    expect(bracketsContaining("master_plus")).toEqual(["all", "platinum_plus", "emerald_plus", "diamond_plus", "master_plus"]);
  });

  it("has labels in both languages", () => {
    for (const b of BRACKETS) expect(BRACKET_LABELS[b].tr && BRACKET_LABELS[b].en).toBeTruthy();
    for (const g of TIER_GROUPS) expect(GROUP_LABELS[g].tr && GROUP_LABELS[g].en).toBeTruthy();
  });

  it("parseBracket defaults when missing and rejects unknown", () => {
    expect(parseBracket(undefined)).toBe("emerald_plus");
    expect(parseBracket("")).toBe("emerald_plus");
    expect(parseBracket("gold_minus")).toBe("gold_minus");
    expect(parseBracket("bogus")).toBeNull();
  });
});

import { REGIONS, REGION_BRACKETS, REGION_PLATFORM, isRegion } from "./brackets.ts";

describe("regions", () => {
  it("maps each region to its match id prefix", () => {
    expect(REGIONS.map((r) => REGION_PLATFORM[r])).toEqual(["TR1", "EUW1", "KR"]);
    expect(isRegion("kr")).toBe(true);
    expect(isRegion("na")).toBe(false);
    expect(REGION_BRACKETS).toEqual(["emerald_plus", "all"]);
  });
});
