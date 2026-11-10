import { describe, expect, it } from "vitest";
import { topPath } from "./junglePath";

const jungle = (paths: { side: "top" | "bot"; lane: "top" | "mid" | "bot" | "none"; games: number; winRate: number }[]) => ({
  games: paths.reduce((s, p) => s + p.games, 0),
  paths,
  gank: null,
});

describe("topPath", () => {
  it("is the most played route with its share", () => {
    const path = topPath(jungle([{ side: "bot", lane: "mid", games: 300, winRate: 0.5 }, { side: "top", lane: "top", games: 900, winRate: 0.52 }]));
    expect(path).toMatchObject({ side: "top", lane: "top", games: 900 });
    expect(path?.share).toBeCloseTo(0.75);
  });
  it("is null with no routes, too few games or a sample that says nothing", () => {
    expect(topPath(undefined)).toBeNull();
    expect(topPath(jungle([]))).toBeNull();
    expect(topPath(jungle([{ side: "top", lane: "top", games: 20, winRate: 0.5 }]))).toBeNull();
  });
});
