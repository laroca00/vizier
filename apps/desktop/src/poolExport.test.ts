import { describe, expect, it } from "vitest";
import type { PoolPick } from "./personal";
import type { SavedBuild } from "./library/store";
import { itemSetOf, planPoolExport, summarize } from "./poolExport";

const pick = (championId: number, position: string | null, buildId: string | null = null): PoolPick => ({ championId, position, rank: "main", note: "", buildId });
const build = (id: string, championId: number, extra: Partial<SavedBuild> = {}): SavedBuild => ({
  id, name: "Build", championId, position: "MIDDLE", runes: { primaryStyle: 8000, subStyle: 8100, perks: [] }, spells: [4, 14],
  startItems: [1056], coreItems: [6655], items: [], skillOrder: [1, 2, 3], notes: "", collections: [], favourite: false, source: "custom", createdAt: 0, updatedAt: 0, ...extra,
});
const labels = { start: "Start", core: "Core", more: "More" };

describe("pool export", () => {
  it("uses the chosen saved build and falls back to the recommended one", () => {
    const plans = planPoolExport([pick(103, "MIDDLE", "a"), pick(238, "MIDDLE", "gone"), pick(1, "MIDDLE")], [build("a", 103)]);
    expect(plans.map((p) => p.saved?.id ?? null)).toEqual(["a", null, null]);
  });

  it("ignores a chosen build of another champion", () => {
    expect(planPoolExport([pick(103, null, "a")], [build("a", 238)])[0].saved).toBeNull();
  });

  it("lists a champion once per role", () => {
    expect(planPoolExport([pick(103, "MIDDLE"), pick(103, "MIDDLE"), pick(103, "TOP")], [])).toHaveLength(2);
  });

  it("makes no item set from a build without items", () => {
    expect(itemSetOf(build("a", 103, { startItems: [], coreItems: [], items: [] }), labels)).toBeNull();
    expect(itemSetOf(build("a", 103), labels)?.blocks.map((b) => b.title)).toEqual(["Start", "Core"]);
  });

  it("counts results", () => {
    expect(summarize(["written", "written", "skipped", "failed"])).toEqual({ written: 2, skipped: 1, failed: 1 });
  });
});
