import { describe, expect, it } from "vitest";
import { chosenPath, type ItemNode } from "./itemPath";

const node = (id: number, games: number, winRate: number, next: ItemNode[] = []): ItemNode => ({ id, games, winRate, next });
const tree = [
  node(1, 600, 0.5, [node(2, 400, 0.49, [node(3, 300, 0.48)]), node(4, 150, 0.56, [node(5, 120, 0.58)])]),
  node(6, 200, 0.6, [node(7, 15, 0.9)]),
];

describe("chosenPath", () => {
  it("follows the most played branch for popular", () => {
    expect(chosenPath(tree, "popular", 1000)).toEqual({ ids: [1, 2, 3], games: 300, winRate: 0.48 });
  });

  it("picks the best win rate among routes with enough games for winning", () => {
    // The 15-game route at 90% is below the bar; 6 -> 7 is out, so 1 -> 4 -> 5 wins.
    expect(chosenPath(tree, "winning", 1000)).toEqual({ ids: [1, 4, 5], games: 120, winRate: 0.58 });
  });

  it("is null without a tree or when no route has enough games", () => {
    expect(chosenPath(undefined, "winning", 1000)).toBeNull();
    expect(chosenPath([node(1, 5, 0.9)], "winning", 1000)).toBeNull();
  });
});

describe("importCore", () => {
  const tree = [
    { id: 1, games: 600, winRate: 0.5, next: [{ id: 2, games: 400, winRate: 0.55, next: [{ id: 3, games: 300, winRate: 0.58, next: [] }] }, { id: 4, games: 100, winRate: 0.45, next: [] }] },
    { id: 9, games: 300, winRate: 0.6, next: [{ id: 10, games: 280, winRate: 0.62, next: [{ id: 11, games: 250, winRate: 0.64, next: [] }] }] },
  ];
  it("keeps the build's own core items unless a route is asked for", async () => {
    const { importCore } = await import("./itemPath");
    expect(importCore({ ids: [5, 6, 7] }, tree, "default", 900)).toEqual({ ids: [5, 6, 7], path: null });
  });
  it("follows the most played route or the best winning one", async () => {
    const { importCore } = await import("./itemPath");
    expect(importCore({ ids: [5, 6, 7] }, tree, "popular", 900).ids).toEqual([1, 2, 3]);
    expect(importCore({ ids: [5, 6, 7] }, tree, "winning", 900)).toMatchObject({ ids: [9, 10, 11], path: { games: 250, winRate: 0.64 } });
  });
  it("falls back to the build's core when there is no tree or no route clears the bar", async () => {
    const { importCore } = await import("./itemPath");
    expect(importCore({ ids: [5] }, undefined, "popular", 900)).toEqual({ ids: [5], path: null });
    expect(importCore({ ids: [5] }, tree, "winning", 1_000_000).ids).toEqual([5]);
    expect(importCore(null, undefined, "default", 0).ids).toEqual([]);
  });
  it("reads only known choices from storage", async () => {
    const { sanitizeImportPath } = await import("./itemPath");
    expect(["winning", "popular", "x", undefined].map(sanitizeImportPath)).toEqual(["winning", "popular", "default", "default"]);
  });
});
