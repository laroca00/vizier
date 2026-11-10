import { describe, expect, it } from "vitest";
import { previousPatchBlend } from "./patchBlend";

const sample = (patch: string, games: number, winRate: number) => ({ patch, games, winRate });

describe("previousPatchBlend", () => {
  it("shows the previous patch while the new one is thin and the old one is solid", () => {
    expect(previousPatchBlend([sample("16.22", 12, 0.6), sample("16.21", 1200, 0.5)])).toEqual(sample("16.21", 1200, 0.5));
    expect(previousPatchBlend([sample("16.22", 0, 0), sample("16.21", 1200, 0.5)])).toEqual(sample("16.21", 1200, 0.5));
  });
  it("keeps the numbers as sent once the new patch passes the rule", () => {
    expect(previousPatchBlend([sample("16.22", 3000, 0.52), sample("16.21", 1200, 0.5)])).toBeNull();
  });
  it("has nothing to show when both are thin or there is one patch", () => {
    expect(previousPatchBlend([sample("16.22", 12, 0.6), sample("16.21", 20, 0.5)])).toBeNull();
    expect(previousPatchBlend([sample("16.22", 12, 0.6)])).toBeNull();
    expect(previousPatchBlend(undefined)).toBeNull();
  });
});
