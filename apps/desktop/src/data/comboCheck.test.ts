import { describe, expect, it } from "vitest";
import type { HistoryStep } from "../patches/history";
import { changedAbilities, comboChangedIn } from "./comboCheck";
import type { Combo } from "./combos";

const step = (to: string, ...fields: string[]): HistoryStep => ({
  from: "x",
  to,
  entry: { kind: "champion", id: "103", name: "Ahri", status: "changed", changes: fields.map((field) => ({ field, before: 1, after: 2 })) },
});
const combo = (sequence: string[]) => ({ sequence }) as Combo;

describe("combo patch check", () => {
  it("ignores changes up to the patch the combos were written for", () => {
    expect(changedAbilities([step("16.21.1", "spell:Q:cooldown")], "16.21").size).toBe(0);
  });
  it("collects ability changes from newer patches and keeps the oldest patch", () => {
    const changed = changedAbilities([step("16.23.1", "spell:E:range"), step("16.22.1", "spell:E:cost", "stat:hp", "spell:R:cooldown")], "16.21");
    expect([...changed.entries()].sort()).toEqual([["E", "16.22.1"], ["R", "16.22.1"]]);
  });
  it("flags only combos that use a changed ability, including second casts", () => {
    const changed = new Map([["Q", "16.22.1"]]);
    expect(comboChangedIn(combo(["E", "Q2"]), changed)).toBe("16.22.1");
    expect(comboChangedIn(combo(["E", "W", "AA", "Flash"]), changed)).toBeNull();
  });
});
