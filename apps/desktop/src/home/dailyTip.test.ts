import { describe, expect, it } from "vitest";
import type { Combo } from "../data/combos";
import { dailyCombo, localDay } from "./dailyTip";

const combo = (id: string) => ({ id }) as Combo;
const table: Record<string, Combo[]> = { Ahri: [combo("a1"), combo("a2")], Zed: [combo("z1")], Garen: [] };
const combosOf = (id: string) => table[id] ?? [];

describe("dailyCombo", () => {
  it("prefers the pool and walks it day by day", () => {
    expect(dailyCombo(0, ["Ahri", "Zed"], ["Ahri", "Zed", "Garen"], combosOf)).toEqual({ championId: "Ahri", combo: table.Ahri[0] });
    expect(dailyCombo(1, ["Ahri", "Zed"], [], combosOf)).toEqual({ championId: "Zed", combo: table.Zed[0] });
    // Two days later Ahri comes round again with her second combo.
    expect(dailyCombo(2, ["Ahri", "Zed"], [], combosOf)?.combo.id).toBe("a2");
  });

  it("falls back to every champion when the pool has no combos, and to nothing at all", () => {
    expect(dailyCombo(0, ["Garen"], ["Garen", "Zed"], combosOf)?.championId).toBe("Zed");
    expect(dailyCombo(0, [], [], combosOf)).toBeNull();
  });
});

describe("localDay", () => {
  it("counts whole days", () => {
    const a = localDay(new Date(2026, 10, 10, 0, 5));
    const b = localDay(new Date(2026, 10, 10, 23, 55));
    const c = localDay(new Date(2026, 10, 11, 0, 5));
    expect(a).toBe(b);
    expect(c).toBe(a + 1);
  });
});
