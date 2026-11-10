import { describe, expect, it } from "vitest";
import type { BoardRow, TierEntry } from "../api";
import { averageSolid, goldDiffSolid, joinStats, viewStats, winRateSolid } from "./statsTable";

const tier = (championId: number, games: number, winRate: number, pickRate = 0.1, banRate: number | null = 0.05): TierEntry =>
  ({ championId, games, winRate, pickRate, banRate, tier: "A", winRateChange: null });
const board = (championId: number, extra: Partial<BoardRow> = {}): BoardRow => ({ championId, games: 80, kills: 5, deaths: 4, assists: 6, kda: 2.75, csPerMinute: 7, minutes: 30, goldDiff15: { games: 40, value: 120 }, ...extra });

const names: Record<number, string> = { 1: "Annie", 2: "Ahri", 3: "Zed", 4: "Yone" };
const nameOf = (id: number) => names[id];

describe("joinStats", () => {
  it("puts the board row next to the tier row and leaves it empty when there is none", () => {
    const rows = joinStats("MIDDLE", [tier(1, 500, 0.5), tier(2, 300, 0.52)], { rows: [board(2)] });
    expect(rows.map((r) => r.board?.championId ?? null)).toEqual([null, 2]);
    expect(rows[0]).toMatchObject({ championId: 1, position: "MIDDLE", games: 500, banRate: 0.05 });
    expect(joinStats("MIDDLE", [tier(1, 5, 0.5)], null)[0].board).toBeNull();
  });
});

describe("viewStats", () => {
  const rows = joinStats("MIDDLE", [tier(1, 500, 0.5), tier(2, 300, 0.56), tier(3, 120, 0.48), tier(4, 60, 0.6)], {
    rows: [board(1, { kda: 2 }), board(2, { kda: 4, goldDiff15: { games: 40, value: -50 } }), board(3, { kda: 3, goldDiff15: null })],
  });
  const ids = (list: ReturnType<typeof viewStats>) => list.map((r) => r.championId);

  it("sorts by a column in both directions, and puts missing values last either way", () => {
    expect(ids(viewStats(rows, { sort: "kda", desc: true, minGames: 0, query: "" }, nameOf))).toEqual([2, 3, 1, 4]);
    expect(ids(viewStats(rows, { sort: "kda", desc: false, minGames: 0, query: "" }, nameOf))).toEqual([1, 3, 2, 4]);
    expect(ids(viewStats(rows, { sort: "goldDiff15", desc: true, minGames: 0, query: "" }, nameOf))).toEqual([1, 2, 3, 4]);
    expect(ids(viewStats(rows, { sort: "goldDiff15", desc: false, minGames: 0, query: "" }, nameOf))).toEqual([2, 1, 3, 4]);
  });
  it("sorts names alphabetically, ascending first", () => {
    expect(ids(viewStats(rows, { sort: "name", desc: false, minGames: 0, query: "" }, nameOf))).toEqual([2, 1, 4, 3]);
    expect(ids(viewStats(rows, { sort: "name", desc: true, minGames: 0, query: "" }, nameOf))).toEqual([3, 4, 1, 2]);
  });
  it("filters by minimum games and name", () => {
    expect(ids(viewStats(rows, { sort: "games", desc: true, minGames: 100, query: "" }, nameOf))).toEqual([1, 2, 3]);
    expect(ids(viewStats(rows, { sort: "games", desc: true, minGames: 0, query: " an" }, nameOf))).toEqual([1]);
  });
});

describe("solid samples", () => {
  it("judges win rate by its interval and averages by their own games", () => {
    const [few, many] = joinStats("TOP", [tier(1, 20, 0.7), tier(2, 5000, 0.5)], { rows: [board(1, { games: 10, goldDiff15: { games: 5, value: 1 } }), board(2)] });
    expect([winRateSolid(few), winRateSolid(many)]).toEqual([false, true]);
    expect([averageSolid(few), averageSolid(many)]).toEqual([false, true]);
    expect([goldDiffSolid(few), goldDiffSolid(many)]).toEqual([false, true]);
  });
});
