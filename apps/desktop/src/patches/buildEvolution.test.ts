import { describe, expect, it } from "vitest";
import type { Build, BuildSnapshot } from "../api";
import { compareBuilds, moveOf, snapshotOf } from "./buildEvolution";

const snap = (patch: string, games: number, items: [number, number][], keystone = 8112, maxOrder = [1, 2, 3], core = [1, 2, 3]): BuildSnapshot => ({
  patch,
  games,
  winRate: 0.5,
  runes: [{ primaryStyle: 8100, subStyle: 8300, perks: [keystone], games, winRate: 0.5 }],
  spells: null,
  startItems: null,
  coreItems: { ids: core, games, winRate: 0.5 },
  items: items.map(([id, g]) => ({ id, games: g, winRate: 0.5 })),
  skills: { maxOrder, firstLevels: [1, 2, 3], games, winRate: 0.5 },
});

describe("moveOf", () => {
  it("needs a five point change in share", () => {
    expect(moveOf(0.3, 0.36)).toBe("rising");
    expect(moveOf(0.3, 0.24)).toBe("falling");
    expect(moveOf(0.3, 0.33)).toBe("steady");
    expect(moveOf(null, 0.2)).toBe("new");
    expect(moveOf(0.2, null)).toBe("gone");
  });
});

describe("compareBuilds", () => {
  const before = snap("16.20", 1000, [[1, 800], [2, 500], [3, 300]]);
  const after = snap("16.21", 500, [[1, 400], [2, 100], [4, 250]], 8010, [2, 1, 3], [1, 4, 3]);
  const result = compareBuilds(before, after);
  it("compares shares of each side's own games", () => {
    const first = result.items.find((i) => i.id === 1)!;
    expect(first.before?.share).toBeCloseTo(0.8);
    expect(first.after?.share).toBeCloseTo(0.8);
    expect(first.move).toBe("steady");
    expect(result.items.find((i) => i.id === 2)!.move).toBe("falling");
  });
  it("marks items that arrived or dropped out", () => {
    expect(result.items.find((i) => i.id === 4)!.move).toBe("new");
    expect(result.items.find((i) => i.id === 3)!.move).toBe("gone");
  });
  it("lists the biggest movers first", () => {
    expect(result.items.map((i) => i.id)).toEqual([4, 2, 3, 1]);
  });
  it("notices rune, skill and core changes", () => {
    expect(result.runes.keystoneChanged).toBe(true);
    expect(result.runes.styleChanged).toBe(false);
    expect(result.skills.changed).toBe(true);
    expect(result.core.changed).toBe(true);
  });
  it("sees no change between equal builds", () => {
    const same = compareBuilds(before, before);
    expect(same.items.every((i) => i.move === "steady")).toBe(true);
    expect(same.runes.keystoneChanged || same.skills.changed || same.core.changed).toBe(false);
  });
});

describe("snapshotOf", () => {
  it("keeps the top choices of a build", () => {
    const build = { patches: ["16.21", "16.20"], games: 900, winRate: 0.51, runes: [], spells: [{ ids: [4, 14], games: 800, winRate: 0.5 }], items: Array.from({ length: 12 }, (_, i) => ({ id: i, games: 10, winRate: 0.5 })), startItems: null, coreItems: null, skills: null, vs: null } as unknown as Build;
    const s = snapshotOf(build);
    expect(s.patch).toBe("16.21, 16.20");
    expect(s.items).toHaveLength(8);
    expect(s.spells?.ids).toEqual([4, 14]);
  });
});
