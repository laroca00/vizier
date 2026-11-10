import { describe, expect, it } from "vitest";
import type { BoardRow, TierEntry } from "../api";
import { addPick, compareCell, leaderOf, MAX_COMPARED } from "./compare";
import { joinStats } from "./statsTable";

const tier = (championId: number, games: number, winRate: number): TierEntry => ({ championId, games, winRate, pickRate: 0.1, banRate: 0.02, tier: "A", winRateChange: null });
const board = (championId: number, extra: Partial<BoardRow> = {}): BoardRow => ({ championId, games: 200, kills: 5, deaths: 4, assists: 6, kda: 2.75, csPerMinute: 7, minutes: 30, goldDiff15: { games: 100, value: 100 }, late: { games: 300, winRate: 0.5 }, ...extra });
const rows = joinStats("MIDDLE", [tier(1, 2000, 0.53), tier(2, 2000, 0.5), tier(3, 40, 0.8)], { rows: [board(1, { kda: 3.5 }), board(2), board(3, { games: 10 })] });

describe("compareCell", () => {
  it("carries the value, its games and whether the sample is solid", () => {
    expect(compareCell(rows[0], "kda")).toEqual({ value: 3.5, solid: true, games: 200 });
    expect(compareCell(rows[2], "kda")).toEqual({ value: 2.75, solid: false, games: 10 });
    expect(compareCell(rows[2], "winRate").solid).toBe(false);
    expect(compareCell(rows[0], "lateWinRate")).toEqual({ value: 0.5, solid: true, games: 300 });
    expect(compareCell(undefined, "kda")).toEqual({ value: null, solid: false, games: null });
  });
});

describe("leaderOf", () => {
  it("names the champion strictly ahead among solid figures", () => {
    const cells = rows.map((r) => compareCell(r, "winRate"));
    expect(leaderOf(cells, "winRate")).toBe(0);
    expect(leaderOf(rows.map((r) => compareCell(r, "kda")), "kda")).toBe(0);
  });
  it("ignores a thin sample, however high, and ties", () => {
    const thin = [compareCell(rows[2], "winRate"), compareCell(rows[1], "winRate")];
    expect(leaderOf(thin, "winRate")).toBeNull();
    expect(leaderOf([compareCell(rows[1], "csPerMinute"), compareCell(rows[1], "csPerMinute")], "csPerMinute")).toBeNull();
  });
  it("has no leader for stats that only describe play", () => {
    expect(leaderOf(rows.map((r) => compareCell(r, "pickRate")), "pickRate")).toBeNull();
    expect(leaderOf(rows.map((r) => compareCell(r, "minutes")), "minutes")).toBeNull();
  });
});

describe("addPick", () => {
  it("skips repeats and keeps the newest three", () => {
    let picks = addPick([], { championId: 1, position: "TOP" });
    picks = addPick(picks, { championId: 1, position: "TOP" });
    expect(picks).toHaveLength(1);
    picks = addPick(addPick(addPick(picks, { championId: 2, position: "TOP" }), { championId: 3, position: "TOP" }), { championId: 4, position: "TOP" });
    expect(picks.map((p) => p.championId)).toEqual([2, 3, 4]);
    expect(picks).toHaveLength(MAX_COMPARED);
    expect(addPick(picks, { championId: 2, position: "MIDDLE" })).toHaveLength(MAX_COMPARED);
  });
});
