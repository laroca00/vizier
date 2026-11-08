import { describe, expect, it } from "vitest";
import type { TierEntry } from "../api";
import type { PatchDiff } from "../patches/load";
import { DEFAULT_HOME, moveCard, normalizeHome, toggleCard } from "./layout";
import { thisPatchRows } from "./thisPatch";

const tier = (championId: number, tierName: string, winRate: number, winRateChange: number | null): TierEntry => ({ championId, games: 500, winRate, pickRate: 0.05, tier: tierName, winRateChange });

describe("thisPatchRows", () => {
  const lists = { MIDDLE: [tier(103, "A", 0.52, 0.004), tier(7, "C", 0.48, -0.02)], TOP: [tier(86, "S", 0.53, 0.01)] };
  const diff: PatchDiff = {
    from: "16.21.1",
    to: "16.22.1",
    itemNames: {},
    entries: [{ kind: "champion", id: "103", name: "Ahri", status: "changed", changes: [{ field: "stat:hp", before: 570, after: 590 }] }],
  };

  it("puts patched champions first, then the biggest moves, with tier and verdict", () => {
    const rows = thisPatchRows([{ championId: 7, position: "MIDDLE" }, { championId: 103, position: "MIDDLE" }, { championId: 86, position: "TOP" }], lists, diff);
    expect(rows.map((r) => r.championId)).toEqual([103, 7, 86]);
    expect(rows[0]).toMatchObject({ tier: "A", verdict: "buff", changes: [{ field: "stat:hp" }] });
    expect(rows[1].verdict).toBeNull();
  });

  it("works without a cached diff", () => {
    expect(thisPatchRows([{ championId: 86, position: "TOP" }], lists, null)[0]).toMatchObject({ tier: "S", verdict: null, changes: [] });
  });
});

describe("home layout", () => {
  it("fills in missing cards and drops unknown ones", () => {
    expect(normalizeHome({ order: ["pros", "nope" as never, "pros"], hidden: ["lists"] })).toEqual({ order: ["pros", "lists", "thisPatch", "metaPicks", "metaMovers"], hidden: ["lists"] });
    expect(normalizeHome(undefined)).toEqual(DEFAULT_HOME);
  });

  it("moves and hides cards", () => {
    const moved = moveCard(DEFAULT_HOME, "metaPicks", -1);
    expect(moved.order.slice(0, 3)).toEqual(["lists", "metaPicks", "thisPatch"]);
    expect(moveCard(DEFAULT_HOME, "lists", -1)).toBe(DEFAULT_HOME);
    expect(toggleCard(toggleCard(DEFAULT_HOME, "pros"), "pros").hidden).toEqual([]);
  });
});
