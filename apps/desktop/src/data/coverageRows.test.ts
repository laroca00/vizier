import { describe, expect, it } from "vitest";
import type { CoverageDoc } from "../api";
import { coverageRows } from "./coverageRows";

const base: CoverageDoc = { patches: ["16.21", "16.20"], games: [], timeline: [], players: [] };

describe("coverageRows", () => {
  it("is null for docs from before brackets existed", () => {
    expect(coverageRows(null)).toBeNull();
    expect(coverageRows(base)).toBeNull();
    expect(coverageRows({ ...base, brackets: [] })).toBeNull();
  });

  it("gives one row per bracket for the newest patch, with games per platform", () => {
    const result = coverageRows({
      ...base,
      brackets: [
        { patch: "16.21", queue: 420, bracket: "all", platform: "TR1", games: 30 },
        { patch: "16.21", queue: 420, bracket: "all", platform: "EUW1", games: 50 },
        { patch: "16.21", queue: 420, bracket: "all", platform: "KR", games: 20 },
        { patch: "16.21", queue: 420, bracket: "gold_minus", platform: "EUW1", games: 40 },
        { patch: "16.20", queue: 420, bracket: "all", platform: "EUW1", games: 999 },
        { patch: "16.21", queue: 450, bracket: "all", platform: "EUW1", games: 999 },
      ],
      timelineBrackets: [{ patch: "16.21", queue: 420, bracket: "gold_minus", players: 100, withTimeline: 20, share: 0.2 }],
    })!;
    expect(result.patch).toBe("16.21");
    expect(result.rows).toHaveLength(6);
    expect(result.rows.find((r) => r.bracket === "all")).toMatchObject({ games: 100, platforms: { TR1: 30, EUW1: 50, KR: 20 }, timelineShare: null });
    expect(result.rows.find((r) => r.bracket === "gold_minus")).toMatchObject({ games: 40, timelineShare: 0.2 });
    expect(result.rows.find((r) => r.bracket === "master_plus")?.games).toBe(0);
  });
});

describe("droppedGames", () => {
  it("sums the dropped games of the patch and their share of all crawled", async () => {
    const { droppedGames } = await import("./coverageRows");
    const doc = {
      patches: ["16.21"],
      games: [{ patch: "16.21", queue: 420, games: 900 }],
      timeline: [],
      players: [],
      dropped: [
        { patch: "16.21", queue: 420, reason: "afk", games: 60 },
        { patch: "16.21", queue: 420, reason: "surrender", games: 40 },
        { patch: "16.20", queue: 420, reason: "afk", games: 5 },
      ],
    };
    expect(droppedGames(doc, "16.21")).toEqual({ surrender: 40, afk: 60, share: 0.1 });
    expect(droppedGames({ ...doc, dropped: [] }, "16.21")).toBeNull();
  });
});

describe("roleFixedGames", () => {
  it("sums ranked games of the patch", async () => {
    const { roleFixedGames } = await import("./coverageRows");
    const doc = { ...base, roleFixed: [{ patch: "16.21", queue: 420, games: 7 }, { patch: "16.20", queue: 420, games: 3 }] };
    expect(roleFixedGames(doc, "16.21")).toBe(7);
    expect(roleFixedGames(base, "16.21")).toBe(0);
  });
});

describe("statusRows", () => {
  it("lists every bracket in order, with a missing one as never published", async () => {
    const { statusRows } = await import("./coverageRows");
    const rows = statusRows({ ...base, status: [{ bracket: "gold_minus", lastPublishAt: 5, held: ["x"] }, { bracket: "emerald_plus", lastPublishAt: 9, held: [] }] });
    expect(rows?.map((r) => r.bracket)).toEqual(["all", "gold_minus", "platinum_plus", "emerald_plus", "diamond_plus", "master_plus"]);
    expect(rows?.find((r) => r.bracket === "gold_minus")).toEqual({ bracket: "gold_minus", lastPublishAt: 5, held: ["x"] });
    expect(rows?.find((r) => r.bracket === "all")).toEqual({ bracket: "all", lastPublishAt: null, held: [] });
    expect(statusRows(base)).toBeNull();
  });
});

describe("modeGamesPerDay", () => {
  it("adds the modes of a day together, newest day first", async () => {
    const { modeGamesPerDay } = await import("./coverageRows");
    const doc = { ...base, modeDays: [{ day: "2026-11-09", queue: 450, games: 30 }, { day: "2026-11-10", queue: 450, games: 10 }, { day: "2026-11-10", queue: 1700, games: 5 }] };
    expect(modeGamesPerDay(doc)).toEqual([{ day: "2026-11-10", games: 15 }, { day: "2026-11-09", games: 30 }]);
    expect(modeGamesPerDay(null)).toEqual([]);
  });
});
