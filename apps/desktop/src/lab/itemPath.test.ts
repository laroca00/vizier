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
